// const Admin =require("../models/Admin");

// //lấy data admin
// const getAdminsAPI = async(req, res)=>{
//     let results = await Admin.find({}).sort({ createdAt: -1 });
    
//     return res.status(200).json(
//         {
//             errorCode: 0,
//             data: results
//         }
//     )

// }
// //
// module.exports ={
//     getAdminsAPI
// }