const mongoose = require('mongoose');
require('dotenv').config();

const connection=mongoose.connect(process.env.DB_CONNECTION_STRING).then(()=>{
    console.log("connected to database");
  }).catch(()=>{
    console.log("connection to database failed");
  });
module.exports = connection;