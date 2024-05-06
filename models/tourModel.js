const mongoose = require('mongoose');

// const User = require('./userModel.js');
// const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: [true, 'A Ticket must have a source']
    },
    destination: {
      type: String,
      required: [true, 'A Ticket must have a destination']
    },
    date: {
      type: String,
      // default: '---'
      required: [true, 'Ticket must have Depart date']
    },
    returnDate: {
      type: String,
      // default: '---'
      required: [true, 'Ticket must have return date']
    },
    trainClass: {
      type: String,
      required: [true, 'each ticket must have Train Class']
    },
    adultNum: {
      type: Number,
      required: [true, 'Please enter number of seats for adult']
    },
    childNum: {
      type: Number,
      // default: 0
      required: [true, 'Ticket must include childern number']
    },
    price: {
      type: Number,
      required: [true, 'invalid price']
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
