const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const DiarySchema = new Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    date: {
        type: String,
    },
    translate: {
        title: String,
        content: String
    },
    image: {
        _id: String,
        cloudinaryURL: String
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Diary', DiarySchema);