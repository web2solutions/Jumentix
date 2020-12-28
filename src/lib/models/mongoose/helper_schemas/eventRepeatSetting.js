import mongoose from 'mongoose'

let Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId

export const eventRepeatSettingSchema = new Schema({
  event_repeat_type: {
    type: String,
    required: [true, 'Event Repeat Type is required.'],
    enum: ['Daily', 'Weekly', 'Monthly', 'Yearly']
  },
  day_interval: {
    type: Number
  },
  only_weekdays: {
    type: Boolean
  },
  week_interval: {
    type: Number,
    required: function () {
      return this.only_weekdays
    }
  },
  weekdays: {
    type: String,
    enum: [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ]
  },
  month_interval: {
    type: Number
  },
  month_date: {
    type: Number
  },
  month_day: {
    type: String,
    enum: [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ]
  },
  year_date: {
    type: Number
  },
  year_day: {
    type: String,
    enum: [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ]
  },
  year_month: {
    type: String,
    enum: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'Jun',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ]
  },
  end_after_occurance: {
    type: Number
  },
  endDate: {
    type: Date
  }
})
