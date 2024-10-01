const mongoose = require('mongoose');
const { Schema } = mongoose;

const CustomerSchema = new Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
  },
  phoneNumber: {
    type: String,
  },
  gender: {
    type: String,
    enum: ["male", "female", "non-binary", "other"],
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
    validate: {
      validator: function (value) {
        // Ensure the date is in the past
        return value < new Date();
      },
      message: "Date of birth must be in the past.",
    },
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  orderHistory: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
},
{ timestamps: true }
);

CustomerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

CustomerSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};
const Customer = mongoose.model('Customer', CustomerSchema);
module.exports = Customer;