const { connection } = require("mongoose")

const getAllUser =async () =>{
  let[results,fields] = await connection.query(`select*from admin`)
  return results
}

module.exports ={
  getAllUser
}