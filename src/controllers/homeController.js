
const Admin =require("../models/Admin");

const getHomepage = async (req, res) => {
  // let results = await Admin.find({});
  return res.render('home.ejs');
};
//admin
const getCreatePage =async (req, res) => {
  let results = await Admin.find({}).sort({ createdAt: -1 });
  res.render('Admin/create_admin.ejs', { listUser: results });
};

const postCreateAdmin = async (req, res) => {
  let Username = req.body.Username;
  let Password = req.body.Password;
  console.log(">>>>> username= ", Username, "password =", Password);
  await Admin.create({
    username: Username,
    password: Password
  })
  res.redirect('/create_admin')
};

const getUpdateAdmin = async(req,res) =>{
  console.log(">>>> req.param: ",req.params)
  const adminID = req.params.id;
  let admin = await Admin.findById(adminID).exec()
  res.render('Admin/edit_admin.ejs',{userEdit : admin})
}
const postUpdateAdmin = async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let adminId = req.body.adminId;

  console.log(">>>>> username= ", username, "password =", password);

  await Admin.updateOne({ _id: adminId }, { username: username, password: password });
  res.redirect('/create_admin');
  

  
};
const postDeleteAdmin = async ( req,res) =>{
  const adminID = req.params.id;
  let admin = await Admin.findById(adminID).exec()

  res.render('Admin/delete_admin.ejs',{userEdit : admin});
}
const postHandleRemoveAdmin = async (req,res) =>{
  const adminID = req.body.adminId
  await Admin.deleteOne({_id: adminID })
  console.log("admin has been deleted")
  res.redirect('/create_admin');

}

module.exports = {
  getHomepage,
  postCreateAdmin,
  getCreatePage,
  getUpdateAdmin,
  postUpdateAdmin,
  postDeleteAdmin,
  postHandleRemoveAdmin,
  
};
