var express = require('express')
var gm = require('gm')
var fs = require('fs')
var multer = require('multer')
var zipFolder = require('zip-folder')
var rimraf = require('rimraf')
var bodyParser = require('body-parser')
var urlencodedParser = bodyParser.urlencoded({extended: false})
var fileUpload = multer({dest: './uploaded-files'})
var app = express()
var PNGJS = require('pngjs').PNG

var MY_IP = `178.128.77.198`

var TWILIO_SID = 'ACbdc2d8dc78c436b425110a3c8ac099e9'
var TWILIO_TOKEN = '762334147c22ec15acb29e1d5c27193a'
var twilioClient = require('twilio')(TWILIO_SID, TWILIO_TOKEN)

app.set('view engine', 'ejs')
app.use(bodyParser())

app.get('/', (req, res) => {
    res.render(`${__dirname}/views/home`)
})

app.get('/imageserver', (req, res) => {
    if(!req.query.id || !req.query.photo) return res.sendStatus(404)
    var exists = fs.existsSync(`${__dirname}/uploaded-files/${req.query.id}/${req.query.photo}`)
    console.log(exists, req.query.id, req.query.photo)
    if(!exists) return res.sendStatus(404)
    res.sendFile(`${__dirname}/uploaded-files/${req.query.id}/${req.query.photo}`)
})

app.get('/download', (req, res) => {
    if(!req.query.id) return res.redirect('/')
    var exists = fs.existsSync(`${__dirname}/uploaded-files/${req.query.id}`)
    if(!exists) return res.redirect('/')
    res.sendFile(`${__dirname}/uploaded-files/${req.query.id}.zip`)
    //cleanUp(req.query.id, false)
})

app.post('/process', fileUpload.single('image'), (req, res) => {
    if(!req.file) return res.redirect('/')
    var imageID = Math.random().toString(16).substring(2, 15)
    var imagePath = req.file.filename
    var fileExt = req.file.originalname.split('.')[req.file.originalname.split('.').length-1]
    fs.mkdir(`${__dirname}/uploaded-files/${imageID}`, {}, err => {
        if(err) throw err;
        fs.rename(`${__dirname}/uploaded-files/${imagePath}`, `${__dirname}/uploaded-files/${imageID}/${imagePath}`, (err) => {
            if(err) throw err;
            gm(`${__dirname}/uploaded-files/${imageID}/${imagePath}`).size((err, size) => {
                if(err) throw err;
                if(size.width != size.height) {
                    //RESIZING IMAGE
                    console.log(size)
                    var resizeVal
                    if(size.width < size.height) {resizeVal = size.width} else {resizeVal = size.height}
                    gm(`${__dirname}/uploaded-files/${imageID}/${imagePath}`)
                        .gravity('Center')
                        .crop(resizeVal, resizeVal)
                        .write(`${__dirname}/uploaded-files/${imageID}/${imagePath}`, err => {
                            if(err) throw err
                            runImageShredder()
                        })
                } else {
                    runImageShredder()
                }

                function runImageShredder() {
                    var form = size.height/3
                    var rowNum = 0
                    var colNum = 0
                    var rowPix = 0
                    var colPix = 0
                    var imageNameNum = 9
                    var doneWithIMG = false
                    console.log(imagePath)
                    function checkifDone() {
                        fs.readdir(`${__dirname}/uploaded-files/${imageID}`, (err, files) => {
                            if(err) throw err;
                            console.log(files.length)
                            if(files.length == 10) {
                                fs.unlink(`${__dirname}/uploaded-files/${imageID}/${imagePath}`, (err) => {
                                    if(err) throw err;
                                    console.log(`done with ${imageID}`)
                                    zipFolder(`${__dirname}/uploaded-files/${imageID}`, `${__dirname}/uploaded-files/${imageID}.zip`, err => {
                                        if(err) throw err;
                                        res.redirect(`/download?id=${imageID}`)
                                    })
                                })
                            } else {
                                setTimeout(checkifDone, 500)
                            }
                        })
                    }
                    function sendSMS() {
                        fs.readdir(`${__dirname}/uploaded-files/${imageID}`, (err, files) => {
                            if(err) throw err
                            if(files.length == 10) {
                                fs.unlink(`${__dirname}/uploaded-files/${imageID}/${imagePath}`, err => {
                                    if(err) throw err
                                    sendMessages(imageID, fileExt, req.body.phonenum)
                                    res.redirect('/')
                                })
                            } else {
                                setTimeout(sendSMS, 500)
                            }
                        })
                    }
                    if(req.body.phonenum) {
                        sendSMS()
                    } else {
                        checkifDone()
                    }
                    for(i=0;i<3;i++) {
                        for(x=0;x<3;x++) {
                            gm(`${__dirname}/uploaded-files/${imageID}/${imagePath}`)
                                .gravity(posCalc(rowNum, colNum))
                                .crop(10, 10)
                                .write(`${__dirname}/uploaded-files/${imageID}/${imageNameNum}.${fileExt}`, err => {
                                    if(err) throw err
                                })
                            colPix += form/3
                            imageNameNum -= 1
                            colNum += 1
                        }
                        colNum = 0
                        rowNum += 1
                    }
                }
            })
        })
    })
})

function cleanUp(imageID, auth) {
    if(auth == false) {
        setTimeout(function() {
            cleanUp(imageID, true)
        }, 3000)
    } else {
        fs.unlinkSync(`${__dirname}/uploaded-files/${imageID}.zip`)
        rimraf(`${__dirname}/uploaded-files/${imageID}`, function() {
            console.log(`just cleaned ${imageID}`)
        })
    }
}

function cleanSMS(imageID, auth) {
    if(auth == false) {
        setTimeout(function() {
            cleanSMS(imageID, true)
        }, 3000)
    } else {
        rimraf(`${__dirname}/uploaded-files/${imageID}`, function() {
            console.log('cleaned up a sms photo')
        })
    }
}

function sendMessages(imageID, fileExt, phoneNum) {
    var toSend = []
    var currentMessage = 0
    for(i=1;i<10;i++) {
        toSend.push({
            body: `${i}`,
            from: `+18135318973`,
            to: `+1${phoneNum}`,
            mediaUrl: `http://178.128.77.198:3000/imageserver?id=${imageID}&photo=${i}.${fileExt}`
        })
        console.log(toSend)
    }
    send()
    function send() {
        twilioClient.messages
            .create(toSend[currentMessage])
            .then(message => console.log(`sent message ${currentMessage}`))
            .done()
        currentMessage += 1
        console.log(currentMessage)
        if(toSend[currentMessage]) {
            setTimeout(send, 1000)
        } else {
            cleanSMS(imageID, false)
        }
    }
}

app.listen(3000, console.log('listening on port 3000'))

function posCalc(row, col) {
    var final
    if(col == 0 && row == 0) {final = 'NorthWest'}
    if(col == 1 && row == 0) {final = 'North'}
    if(col == 2 && row == 0) {final = 'NorthEast'}
    if(col == 0 && row == 1) {final = 'West'}
    if(col == 1 && row == 1) {final = 'Center'}
    if(col == 2 && row == 1) {final = 'East'}
    if(col == 0 && row == 2) {final = 'SouthWest'}
    if(col == 1 && row == 2) {final = 'South'}
    if(col == 2 && row == 2) {final = 'SouthEast'}
    return final
}