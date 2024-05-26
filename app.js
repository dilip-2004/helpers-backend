  const fs=require('fs');
  const path=require('path');
  const bcrypt=require('bcryptjs');
  const express=require('express');
  const cors=require('cors');
  const mongoose=require('mongoose');
  const bodyParser=require('body-parser');
  const multer=require('multer');
  const {body,validationResult }=require('express-validator');
  const { v4: uuidv4 } = require('uuid');
  const connectionToDatabase=require('./mongoose');
  const HttpError=require('./HttpError');

  // MINE TYPE MAP
  const MINE_TYPE_MAP={
    'image/png':'png',
    'image/jpeg':'jpeg',
    'image/jpg':'jpg',
  }

  // user image upload check
  const userFileUpload=multer({
    limits:500000,
    storage:multer.diskStorage({
      destination:(req,file,cb)=>{
        cb(null,'./uploads/userImages');
      },
      filename:(req,file,cb)=>{
        const ext=MINE_TYPE_MAP[file.mimetype];
        cb(null,uuidv4() + '.' + ext);
      }
    }),
    fileFilter:(req,file,cb)=>{
      const isValid=!!MINE_TYPE_MAP[file.mimetype];
      const error=isValid ? null : new Error('Invalid Mine Type');
      cb(error,isValid);
    }
  });

  // helper image upload validation
  const helperFileUpload=multer({
    limits:500000,
    storage:multer.diskStorage({
      destination:(req,file,cb)=>{
        cb(null,'./uploads/helperImages');
      },
      filename:(req,file,cb)=>{
        const ext=MINE_TYPE_MAP[file.mimetype];
        cb(null,uuidv4() + '.' + ext);
      }
    }),
    fileFilter:(req,file,cb)=>{
      const isValid=!!MINE_TYPE_MAP[file.mimetype];
      const error=isValid ? null : new Error('Invalid Mine Type');
      cb(error,isValid);
    }
  });

  const app=express();
  app.use(bodyParser.json());
  app.use('/uploads/userImages',express.static(path.join('uploads','userImages')));
  app.use('/uploads/helperImages',express.static(path.join('uploads','helperImages')));
  app.use(cors());

  // db connection
  connectionToDatabase.connection;

  // declare schema
  const Schema=mongoose.Schema;

  // create schema
  const userSchema=new Schema({
    userImage:String,
    userName:String,
    userEmail:String,
    userPassword:String,
    addToCart:[String],
    likes:[String]
  });
  
  // create userModel
  const UserModel=mongoose.model("users",userSchema);
  
  // user signup
  app.post('/api/user/signup', userFileUpload.single('image'), async (req, res, next) => {

    const { userName, userEmail, userPassword } = req.body;

    try {
        const existingUser = await UserModel.findOne({ userEmail: userEmail });

        if (existingUser) {
          if(req.file){
            fs.unlink(req.file.path,err =>{
              console.log(err);
            })
          }
            return res.status(422).json({ message: 'Could not signup, email already exists' });
        }

        const hashedPassword=await bcrypt.hash(userPassword,12);
        console.log(hashedPassword);

        const createUser = new UserModel({
            userImage:req.file.path,
            userName,
            userEmail,
            userPassword:hashedPassword,
        });

        const result = await createUser.save();
        res.status(201).json(result.toObject({getters:true}));
    } catch (err) {
        console.error(err);
        const error = new HttpError('Creating account failed, please try again', 500);
        return next(error);
    }
  });
  
  // user login part
  app.post('/api/user/login',async(req,res,next)=>{

    const {email,password}=req.body;
    console.log(req.body);

    try{
      const hasUser=await UserModel.findOne({userEmail:email});

      if(!hasUser){
        return res.status(404).json({
          message:'data not match'
        });
      }

      let isValidPassword=false;
      isValidPassword=await bcrypt.compare(password,hasUser.userPassword);

      if(!isValidPassword){
        return res.status(404).json({
          message:'data not match'
        });
      }

      res.status(200).json(hasUser.toObject({getters:true}));
    } catch (err) {
      console.log(err);
      res.status(500).json({
        message:'internal server error'
      });
    }
  });
  
  // get user data
  app.get('/api/user/getData',async (req,res,next)=>{

    try{
      const users=await UserModel.find().exec();
      res.status(200).json(users);
    }catch(err){
      const error=new HttpError('error in data retrive from database',500);
      return next(error);
    }
  });

  // add to card api
  app.put('/api/user/addToCart/:userID',async(req,res,next)=>{
    const {userID}=req.params;
    const {helperID}=req.body;

    try {
      const updatedDocument = await UserModel.findByIdAndUpdate(
        userID,
      { $addToSet: { addToCart: helperID } },
      { new: true }
      );
  
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
  
      return res.status(200).json(updatedDocument.toObject({getters:true}));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // remove from card api
  app.put('/api/user/removeFromCart/:userID',async(req,res,next)=>{
    const {userID}=req.params;
    const {helperID}=req.body;

    try {
      const updatedDocument = await UserModel.findByIdAndUpdate(
        userID,
        { $pull: { addToCart: helperID } },
        { new: true } 
      );
  
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
  
      console.log(updatedDocument);
      return res.status(200).json(updatedDocument.toObject({getters:true}));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // delete helpers data from addedlist
  app.put('/api/user/deleteFromCart/:userID',async(req,res,next)=>{
    const {userID}=req.params;
    const {helperID}=req.body;
    console.log(userID,helperID);

    try{
      const updatedDocument=await UserModel.findByIdAndUpdate(
        userID,
        {$pull:{addToCart:helperID}},
        {new:true}
      );

      console.log("after update ",updatedDocument);

      if(!updatedDocument){
        return res.status(404).json({message:'Document not found'});
      }

      return res.status(200).json(updatedDocument.toObject({getters:true}));
    }catch(error){
      console.log(error);
      return res.status(500).json({message:'Internal Server Error'});
    }
  });

  // add likes 
  app.put('/api/user/addLikes/:userID',async(req,res,next)=>{
    const {userID}=req.params;
    const {helperID}=req.body;

    try {
      const updatedDocument = await UserModel.findByIdAndUpdate(
        userID,
        { $addToSet: { likes: helperID } },
        { new: true } 
      );
  
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
  
      return res.status(200).json(updatedDocument.toObject({getters:true}));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // remove likes 
  app.put('/api/user/removeLikes/:userID',async(req,res,next)=>{
    const {userID}=req.params;
    const {helperID}=req.body;

    try {
      const updatedDocument = await UserModel.findByIdAndUpdate(
        userID,
        { $pull: { likes: helperID } },
        { new: true } 
      );
  
      if (!updatedDocument) {
        return res.status(404).json({ message: 'Document not found' });
      }
  
      return res.status(200).json(updatedDocument.toObject({getters:true}));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // send helper data based on cart
  app.get('/api/helper/getCartData/:userID', async (req, res, next) => {
    const { userID } = req.params;
    const { helperIDs } = req.query;
    console.log(userID, helperIDs);

    try {
        const helperIDarray = helperIDs.split(',');
        const helperData = await HelperModel.find({ _id: { $in: helperIDarray } });

        console.log(helperData);

        if (helperData.length === 0) { 
            return res.status(404).json({ message: 'There are no helpers in your cart' });
        }

        res.status(200).json(helperData.map(data => data.toObject({ getters: true })));
    } catch (error) {
        console.error('Error fetching helper data:', error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

  // helper api
  const helperSchema=new Schema({
    helperImage:String,
    helperName:String,
    helperDOB:String,
    helperGender:String,
    helperRole:String,
    helperExperience:String,
    helperWorkTime:String,
    helperEmail:String,
    helperPassword:String,
    helperConfirmPassword:String,
    helperPhoneNumber:String,
    likedID:[String],
    accountActive:String,
    ratedUserID:[{userID:String,ratedValue:Number}],
    helperRating:Number
  });

  const HelperModel=mongoose.model('helpers',helperSchema);


  // get helpers data
  app.get('/api/helper/getData',async(req,res,next)=>{
    let createdHelpers;

    try {
      createdHelpers = await HelperModel.find({}, '-helperPassword -helperConfirmPassword');
    } catch (err) {
      const error = new HttpError('Could not retrieve helpers data from database, try later', 500);
      return next(error);
    }

    const sanitizedHelpers = createdHelpers.map(data => data.toObject({ getters: true }));
    
    res.status(200).json(sanitizedHelpers);
  });

  // get helpers data by role
  app.get('/api/helper/getData/:helperRole',async(req,res,next)=>{
    
    const {helperRole}=req.params;
    let createdHelpers;

    try {
      createdHelpers = await HelperModel.find({helperRole}, '-helperPassword -helperConfirmPassword');
    } catch (err) {
      const error = new HttpError('Could not retrieve helpers data from database, try later', 500);
      return next(error);
    }

    const sanitizedHelpers = createdHelpers.map(data => data.toObject({ getters: true }));
    
    res.status(200).json(sanitizedHelpers);
  });

  // send helper data by helper ID
  app.get('/api/helper/getDataByID/:helperID', async (req, res, next) => {
    const helperID = req.params.helperID;
    let helperData;
    
    try {
        helperData = await HelperModel.findById(helperID);
    } catch (err) {
      const error = new HttpError('Something went wrond, could not find data by id', 404);
      return next(error);
    }

    if(!helperData){
      const error =  new HttpError('could not find the helper for the provided id',500);
      return next(error);
    }

    res.status(200).json(helperData.toObject({getters:true}));
  });

  // helper signup check part , before phone number verification
  app.post('/api/helper/signup/check',async (req,res,next)=>{

    const errors=validationResult(req);
    if(!errors.isEmpty())
    {
      return res.status(400).json({message:'invalid input, check you data'});
    }

    const {helperName,helperDOB,helperGender,helperRole,helperExperience,helperWorkTime,helperEmail,helperPassword,helperConfirmPassword}=req.body;

    const createdHelpers=await HelperModel.find().exec();

    const hasHelper=createdHelpers.find(helper => helper.helperEmail===helperEmail);

    if(hasHelper)
    {
      return res.status(422).json({message:'could not signup, email already exists'});
    }

    res.status(200).json({message:'success'});
  });

  // helper signup part
  app.post('/api/helper/signup',helperFileUpload.single('image'),async (req,res,next)=>{

    const {helperName,helperDOB,helperGender,helperRole,helperExperience,helperWorkTime,helperEmail,helperPassword,helperConfirmPassword,helperPhoneNumber}=req.body;

    try {
      const existingHelper = await UserModel.findOne({ helperEmail: helperEmail });
      
      if (existingHelper) {
        if(req.file){
          fs.unlink(req.file.path,err =>{
            console.log(err);
          })
        }
        return res.status(422).json({ message: 'Could not signup, email already exists' });
      }
      
      const hashedPassword = await bcrypt.hash(helperPassword,12);

      const createHelper=new HelperModel({
        helperImage:req.file.path,
        helperName,
        helperDOB,
        helperGender,
        helperRole,
        helperExperience,
        helperWorkTime,
        helperEmail,
        helperPassword:hashedPassword,
        helperConfirmPassword:hashedPassword,
        helperPhoneNumber,
        accountActive:'Active',
        helperRating:0
      });
      
      const result = await createHelper.save();
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      const error = new HttpError('Creating account failed, please try again', 500);
      return next(error);
    }
  });
    
  // helper login
  app.post('/api/helper/login',async(req,res,next)=>{

    const {email,password}=req.body;
    const helperEmail=email;
    const helperPassword=password;
    console.log(helperEmail,helperPassword);

    try {
      const helper = await HelperModel.findOne({ helperEmail });
      console.log(helper);
      if (!helper) {
        return res.status(404).json({ message: 'Email not found' });
      }

      let isValidPassword=false;
      isValidPassword=await bcrypt.compare(helperPassword,helper.helperPassword);

      if(!isValidPassword){
        return res.status(404).json({ message: 'data not match' });
      }
  
      return res.status(200).json(helper.toObject({getters:true}));
    } catch (error) {
      console.error('login error');
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // update the helper details
  app.put('/api/helper/update/:hid',async(req,res,next)=>{

    const helperID=req.params.hid;
    console.log(helperID);
    const {helperName,helperDOB,helperRole,helperExperience,helperEmail,helperPassword,helperConfirmPassword}=req.body;

    try{
      const updatedDocument=await HelperModel.findByIdAndUpdate(
        {_id:helperID},
        {
          $set:{
            helperName:helperName,
            helperDOB:helperDOB,
            helperRole:helperRole,
            helperExperience:helperExperience,
            helperEmail:helperEmail,
            helperPassword:helperPassword,
            helperConfirmPassword:helperConfirmPassword
          }
        },
        { new: true }
      );

      if(!updatedDocument){
        res.status(404).json({message:'helper not found'})
        return;
      }

      res.status(200).json(updatedDocument.toObject({getters:true}))
    }catch(error){
      res.status(500).json({ message:'Internal server error'});
    }
  });

  // delete helper list
  app.delete('/api/helper/delete/:hid',async(req,res,next)=>{
    const helperID=req.params.hid;
    console.log(helperID);

    try {
      const deletedHelper = await HelperModel.findByIdAndDelete(helperID);
      if (!deletedHelper) {
        const error = new HttpError('Helper not found', 404);
        return next(error);
      }
  
      res.status(200).json({ message: 'Successfully deleted' });
    } catch (err) {
      const error = new HttpError('Deleting helper failed', 500);
      return next(error);
    }
  });

  // add liked user id in the helper db
  app.put('/api/helper/addLikedID/:helperID',async(req,res,next)=>{
    const {helperID}=req.params;
    const {userID}=req.body;
    console.log(helperID,userID);

    try{
      const updatedDocument=await HelperModel.findByIdAndUpdate(
        helperID,
        {$addToSet:{likedID:userID}},
        {new:true}
      );

      if(!updatedDocument){
        res.status(404).json({message:'document not found'});
      }

      res.status(200).json(updatedDocument.toObject({getters:true}));
    }catch(error){
      console.log(error);
      res.status(500).json({message: 'internal server error'});
    }
  });

  // remove liked user id from the helper db
  app.put('/api/helper/removeLikedID/:helperID',async(req,res,next)=>{
    const {helperID}=req.params;
    const {userID}=req.body;

    try{
      const updatedDocument=await HelperModel.findByIdAndUpdate(
        helperID,
        {$pull:{likedID:userID}},
        {new:true}
      );

      if(!updatedDocument){
        res.status(404).json({message:'document not found'});
      }

      res.status(200).json(updatedDocument.toObject({getters:true}));
    }catch(error){
      console.log(error);
      res.status(500).json({message: 'internal server error'});
    }
  });

  // api for activate and deactivate the helper account
  app.put('/api/helper/activeStatus/:helperID',async(req,res,next)=>{
    const helperID=req.params.helperID;
    const {accountActive}=req.body;
    console.log(helperID,accountActive);
    
    try{
      const updatedDocument=await HelperModel.findByIdAndUpdate(
        helperID,
        {accountActive:accountActive},
        {new:true}
      );

      console.log(updatedDocument);

      if(!updatedDocument){
        return res.status(500).json({message:'helper not found'});
      }

      res.status(200).json(updatedDocument.toObject({getters:true}));
    }catch(error){
      return res.status(500).json({message:'Internal server error'});
    }

  });

  // api for change helper worktime
  app.put('/api/helper/WorkTimeUpdate/:helperID',async(req,res,next)=>{
    const helperID=req.params.helperID;
    const {newWorkTime}=req.body;
    console.log(helperID,newWorkTime);
    
    try{
      const updatedDocument=await HelperModel.findByIdAndUpdate(
        helperID,
        {helperWorkTime:newWorkTime},
        {new:true}
      );

      console.log(updatedDocument);

      if(!updatedDocument){
        return res.status(500).json({message:'helper not found'});
      }

      res.status(200).json(updatedDocument.toObject({getters:true}));
    }catch(error){
      return res.status(500).json({message:'Internal server error'});
    }

  });

  // api for store rating value in the helper database
  app.put('/api/helper/helperRating/:helperID/:userID', async (req, res, next) => {
    const { helperID, userID } = req.params;
    const { value } = req.body;
    console.log(helperID, userID, value);
  
    try {
      const helperData = await HelperModel.findById(helperID);
      const index = helperData.ratedUserID.findIndex(data => data.userID === userID);
  
      if (index < 0) {
        const updatedDocument = await HelperModel.findByIdAndUpdate(
          helperID,
          {
            $addToSet: {
              ratedUserID: {
                userID: userID,
                ratedValue: value
              }
            }
          },
          { new: true }
        );
  
        const validRatedValues = updatedDocument.ratedUserID.filter(data => data.ratedValue > 0);
        const sumOfRatedValues = validRatedValues.reduce((acc, cur) => acc + cur.ratedValue, 0);
        const rating = validRatedValues.length > 0 ? sumOfRatedValues / validRatedValues.length : 0;
        console.log(rating);
  
        const newUpdatedDocument = await HelperModel.findByIdAndUpdate(
          helperID,
          {
            $set: {
              helperRating: Math.floor(rating)
            }
          },
          { new: true }
        );
  
        res.status(200).json(newUpdatedDocument.toObject({ getters: true }));
      } else {
        helperData.ratedUserID[index].ratedValue = value;
        const updatedDocument = await HelperModel.findByIdAndUpdate(
          helperID,
          {
            $set: {
              ratedUserID: helperData.ratedUserID
            }
          },
          { new: true }
        );
  
        const validRatedValues = updatedDocument.ratedUserID.filter(data => data.ratedValue > 0);
        const sumOfRatedValues = validRatedValues.reduce((acc, cur) => acc + cur.ratedValue, 0);
        const rating = validRatedValues.length > 0 ? sumOfRatedValues / validRatedValues.length : 0;
        console.log(rating);
  
        const newUpdatedDocument = await HelperModel.findByIdAndUpdate(
          helperID,
          {
            $set: {
              helperRating:Math.floor(rating)
            }
          },
          { new: true }
        );
  
        res.status(200).json(newUpdatedDocument.toObject({ getters: true }));
      }
    } catch (error) {
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

  //error handling

  app.use((req,res)=>{
    const error=new HttpError('page not found' , 404);
    throw error;
  });

  app.use((error,req,res,next)=>{
    if(res.headerSent)
    {
      return next(error);
    }
    res.status(error.code || 500);
    res.json({message: error.message || 'no error'}); 
  });

  app.listen(5000);