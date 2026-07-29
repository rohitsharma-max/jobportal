const mongoose = require('mongoose');
const { DOMAINS, OPPORTUNITY_TYPES } = require('../config/constants');

const opportunitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    company: {
      type: String,
      required: [true, 'Company is required'],
      trim: true,
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
      enum: {
        values: DOMAINS,
        message: '{VALUE} is not a valid domain',
      },
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: {
        values: OPPORTUNITY_TYPES,
        message: 'Type must be either Internship or Job',
      },
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    experience: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    stipendOrSalary: {
      type: String,
      trim: true,
      default: '',
    },
    applicationLink: {
      type: String,
      trim: true,
      default: '',
    },
    requirements: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Opportunity', opportunitySchema);
