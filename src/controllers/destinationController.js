const Destination = require("../models/Destination");


//destination
const getCreateDestination =async(req,res) =>{
  let result = await Destination.find({}).sort({ createdAt: -1 });
  res.render('Destination/create_destination.ejs',{listDestination:result})
}

const postCreateDestination = async(req,res)=>{
  let destinationname = req.body.Destination;
  console.log(">>>>> DestinationName= ", destinationname);
  await Destination.create({
    Destination: destinationname,

  })
  res.send('create a new destination');
}
const getUpdateDestination = async(req,res)=>{
  const DestinationID = req.params.id;
  let destination = await Destination.findById(DestinationID).exec()
  res.render('Destination/edit_destination.ejs',{destinationEdit:destination})
}
const postUpdateDestination = async(req,res) =>{
  let destinationname = req.body.Destination
  let destinationId = req.body.destinationId

  console.log(">>>>> username= ", destinationname);

  await Destination.updateOne({ _id: destinationId }, { Destination: destinationname});
  res.redirect('/create_destination');
}

const postDeleteDestination = async ( req,res) =>{
  const DestinationID = req.params.id;
  let destination = await Destination.findById(DestinationID).exec()

  res.render('Destination/delete_destination.ejs',{destinationEdit:destination})
}
const postHandleRemoveDestination = async (req,res) =>{
  const destinationID = req.body.destinationId
  await Destination.deleteOne({_id: destinationID })
  console.log("admin has been deleted")
  res.redirect('/create_destination');

}
module.exports = {getCreateDestination,
  postCreateDestination,
  getUpdateDestination,
  postUpdateDestination,
  postDeleteDestination,
  postHandleRemoveDestination}