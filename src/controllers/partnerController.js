const Partner = require("../models/Partner");


const getCreatePartner = async (req, res) => {
  let result = await Partner.find({});
  res.render('Partner/create_partner.ejs', { listPartner: result })
}

const postCreatePartner = async (req, res) => {
  let partnername = req.body.Partnername;
  let partnernumber = req.body.Partnernumber
  console.log(">>>>> PartnerName= ", partnername, "partnernumber =", partnernumber);
  await Partner.create({
    partnername: partnername,
    partnernumber: partnernumber
  })
  res.redirect('/create_partner');
}
const getUpdatePartner = async (req, res) => {
  console.log(">>>> req.param: ", req.params)
  const PartnerID = req.params.id;
  let partner = await Partner.findById(PartnerID).exec()
  res.render('Partner/edit_partner.ejs', { partnerEdit: partner })
}
const postUpdatePartner = async (req, res) => {
  let partnername = req.body.Partnername;
  let partnernumber = req.body.Partnernumber
  let partnerId = req.body.PartnerId;

  console.log(">>>>> partnernamee= ", partnername, "partnernumber=", partnernumber);

  await Partner.updateOne({ _id: partnerId }, { partnername: partnername, partnernumber: partnernumber });
  res.redirect('/create_partner');


};

const postDeletePartner = async (req, res) => {
  const PartnerID = req.params.id;
  let partner = await Partner.findById(PartnerID).exec()
  res.render('Partner/delete_partner.ejs', { partnerEdit: partner })
}
const postHandleRemovePartner = async (req, res) => {
  const partnerID = req.body.PartnerId
  await Partner.deleteOne({ _id: partnerID })
  console.log("admin has been deleted")
  res.redirect('/create_partner');

}
module.exports = {
  getCreatePartner,
  postCreatePartner,
  getUpdatePartner,
  postUpdatePartner,
  postDeletePartner,
  postHandleRemovePartner
}