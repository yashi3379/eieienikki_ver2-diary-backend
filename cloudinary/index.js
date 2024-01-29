const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

cloudinary.api.create_upload_preset({
    name: 'yeah-diary-ver2',
    folder: 'yeah-diary-ver2'
}, function(error, result) {
    console.log(result);
});

module.exports = cloudinary;