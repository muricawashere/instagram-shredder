var gm = require('gm')
gm(`${__dirname}/uploaded-files/image.jpg`)
    .gravity('Center')
    .crop(100, 100)
    .write(`${__dirname}/uploaded-files/image.jpg`, err => {
        if(err) throw err
    })