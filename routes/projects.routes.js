const express = require('express');
const projectsRouter = express.Router();

let configData = require('../public/lib/js/config');
let userModel = require('../model/users-model');
let projectModel = require('../model/projectModel')

projectsRouter.route('/register-user').post(function (req, res) {
    var userData = req.body;
    let newUserModel = new userModel(userData);
    var fullUrl = req.protocol + '://' + req.get('host') + 'profilePhotos';
    console.log("REGISTERING USER");
    console.log(userData);
    if (userData.email != ''){
        console.log("1: "+ userData.email);
        userModel.findOne({ 'email': userData.email })
        .lean().exec(function (err, result) { 
            console.log("2");
            console.log(err);
            console.log(result);
            if (!result) {
                console.log("3");
                newUserModel.save()
                    .then(reg => {
                        console.log("4");  console.log(reg);
                         res.send({ 'message': 'User added successfully', 'status': true, 'users': userData });
                    })
                    .catch(err => {
                        res.status(400).send({ 'message': "unable to save in database", 'status': false });
                    });
            }
            else 
                res.send({ 'message': 'User Id or email already exist', 'status': false, 'users': null }); 
        })
    }
    else if (userData.phone != ''){
        userModel.findOne({ 'phone': userData.phone })
        .lean().exec(function (err, result) { 
            if (!result) {
                newUserModel.save()
                    .then(reg => {
                         res.send({ 'message': 'User added successfully', 'status': true, 'users': userData });
                    })
                    .catch(err => {
                        res.status(400).send({ 'message': "unable to save in database", 'status': false });
                    });
            }
            else 
                res.send({ 'message': 'User Id or email already exist', 'status': false, 'users': null }); 
        })
    }
    else if (userData.name != ''){
        userModel.findOne({ 'name': userData.name })
        .lean().exec(function (err, result) { 
            if (!result) {
                newUserModel.save()
                    .then(reg => {
                         res.send({ 'message': 'User added successfully', 'status': true, 'users': userData });
                    })
                    .catch(err => {
                        res.status(400).send({ 'message': "Unable to save in database", 'status': false });
                    });
            }
            else 
                res.send({ 'message': 'Username or email already exist', 'status': false, 'users': null }); 
        })
    }
})

projectsRouter.route('/registerProject').post(function (req, res) {

    var projectData = req.body;
    let newProjectModel = new projectModel(projectData);

    newProjectModel.save().then(result => {
        configData.projectId = projectData.projectId; // store project Id in config-Var in library->js folder

        let newUserModel = new userModel({ 'userId': projectData.userId, 'projectId': res.projectId });
        newUserModel.save().then(result => {
            userModel.find({ 'isAdmin': 0, 'status': { $gt: 0 } }).populate('projects').exec(function (err, usersData) {
                (err) => res.send(err);

                res.send(usersData);
            })
        }).catch(err => {
            res.send(err);
        })
    })
})

projectsRouter.route('/getProject').get(function (req, res) { 
    projectModel.findOne({'status': 1})
    .lean().exec(function (err, projectData) { 
        res.send(projectData);
    })
})

module.exports = projectsRouter;