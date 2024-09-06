const TourType = require("../models/TourType")


const getCreateTourType = async(req,res) =>{
  let result = await TourType.find({});
  return res.render('TourType/create_tourtype.ejs',{listTourType: result});
}
const postCreateTourType = async(req,res) =>{
  let Tourtype = req.body.TypeName;
  console.log(">>>>> typename= ", Tourtype);

  await TourType.create({
    tourType:Tourtype
  })
  res.redirect('/create_tourtype')
}
const getUpdateTourType = async(req,res) =>{
  const TourTypeID = req.params.id;
  let tourtype = await TourType.findById(TourTypeID).exec()
  res.render('TourType/edit_tourtype.ejs',{tourtypeEdit:tourtype})
}
const postUpdateTourType = async (req, res) => {
  let Tourtype = req.body.TypeName;
  let tourtypeId = req.body.tourtypeId;
  console.log(">>>>> username= ", Tourtype );

  await TourType.updateOne({ _id: tourtypeId }, { tourType: Tourtype });
  res.redirect('/create_tourtype');

  
};
const postDeleteTourType = async ( req,res) =>{
  const TourTypeID = req.params.id;
  let tourtype = await TourType.findById(TourTypeID).exec()

  res.render('TourType/delete_tourtype.ejs',{tourtypeEdit:tourtype});
}
const postHandleRemoveTourType = async (req,res) =>{
  const tourtypeID = req.body.tourtypeId
  await TourType.deleteOne({_id: tourtypeID })
  console.log("admin has been deleted")
  res.redirect('/create_tourtype');

}
module.exports = {
  getCreateTourType,
  postCreateTourType,
  getUpdateTourType,
  postUpdateTourType,
  postDeleteTourType,
  postHandleRemoveTourType
}