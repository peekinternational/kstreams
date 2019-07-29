app.controller("dashController", function ($scope, $http, $window, $location, $rootScope, $uibModal) {

    /*save with whom user are chatting*/
    $scope.chatWith = '';
    $scope.chatWithId = '';
    /*save all chats */
    $scope.chats = [];
    $scope.groupchats = [];
    $scope.groupChat = false;
    $scope.allGroups;
    $scope.editMsgIconStatus = false;
    /*socket io connection*/

    $scope.audio = new Audio('audio/call.mp3');
    $scope.ringbell = new Audio('audio/ring_bells.mp3');
    // KURENTO WebRtc functions  ======================================================
    $scope.callCancelTimmer = '';
    $scope.webRtcPeer = null;
    const NO_CALL = 0;
    const PROCESSING_CALL = 1;
    const IN_CALL = 2;
    var callState = 0
    $scope.timmerObj = new timmer('#timmer');
    $scope.inComCallData = 0;
    $scope.setCallState = function (nextState) {
        switch (nextState) {
            case NO_CALL:
                $('#videoCall').attr('disabled', false);
                $('#terminate').attr('disabled', true);
                break;

            case PROCESSING_CALL:
                $('#videoCall').attr('disabled', true);
                $('#terminate').attr('disabled', true);
                break;
            case IN_CALL:
                $('#videoCall').attr('disabled', true);
                $('#terminate').attr('disabled', false);
                break;
            default:
                return;
        }

        callState = nextState;
    }



    function onIceCandidate(candidate) {
        console.log('Local candidate' + JSON.stringify(candidate));

        var message = {
            id: 'onIceCandidate',
            candidate: candidate
        }
        $scope.sendKMessage(message);
    }

    let hostIs = location.host.split(':');
    let webSocketIp = 'kstreams.com';
    if (hostIs[0] == 'localhost') webSocketIp = '127.0.0.1';
    class Ws {
        get newClientPromise() {
            return new Promise((resolve, reject) => {

                let wsClient = new WebSocket('wss://' + webSocketIp + ':8443/one2one');
                console.log(wsClient)
                wsClient.onopen = () => {
                    console.log("connected");
                    resolve(wsClient);
                };
                wsClient.onerror = error => reject(error);
            })
        }
        get clientPromise() {
            if (!this.promise) {
                this.promise = this.newClientPromise
            }
            return this.promise;
        }
    }
    $scope.wsSingleton = new Ws();

    $scope.sendKMessage = function (message) {
        var jsonMessage = JSON.stringify(message);
        console.log('Senging message: ' + jsonMessage);
        //console.log(webSokt.readyState ,' check state b ',webSokt.OPEN);
        //webSokt.send(jsonMessage);
        $scope.wsSingleton.clientPromise
            .then(wsClient => {
                wsClient.send(jsonMessage);
                console.log('sendKMessage sent');


                wsClient.onmessage = function (message) {
                    var parsedMessage = JSON.parse(message.data);
                    console.info('Received message: ' + message.data);

                    switch (parsedMessage.id) {
                        case 'registerResponse':
                            //resgisterResponse(parsedMessage);
                            break;
                        case 'callResponse':
                            callResponse(parsedMessage);
                            break;
                        case 'incomingCall':
                            incomingCall(parsedMessage);
                            break;
                        case 'startCommunication':
                            startCommunication(parsedMessage);
                            break;
                        case 'stopCommunication':
                            console.info("Communication ended by remote peer");
                            console.log('Calling stop from 5');
                            $scope.stopK(true);
                            break;
                        case 'iceCandidate':
                            $scope.webRtcPeer.addIceCandidate(parsedMessage.candidate)
                            break;
                        default:
                            console.error('Unrecognized message', parsedMessage);
                    }
                }
            })
            .catch(error => console.log('WS send error: ', error))
    }

    function callResponse(message) {
        if (message.response != 'accepted') {
            console.info('Call not accepted by peer. Closing call');
            var errorMessage = message.message ? message.message
                : 'Unknown reason for call rejection.';
            console.log(errorMessage);
            console.log('Calling stop from 6');
            $scope.stopK(true);
        } else {
            $scope.setCallState(IN_CALL);
            $scope.webRtcPeer.processAnswer(message.sdpAnswer);
        }
    }

    $scope.stopK = function (message, friendId = 0) {
        $scope.setCallState(NO_CALL);
        console.log('stopK Stopping ', $scope.webRtcPeer);
        if ($scope.webRtcPeer) {
            $scope.webRtcPeer.dispose();
            $scope.webRtcPeer = null;
            console.log('Inside stopK ', message);
            if (!message) {
                var message = { id: 'stop' }
                $scope.sendKMessage(message);
            }
        }
        $scope.disconnect(friendId);
    };

    function incomingCall(message) {
        // If bussy just reject without disturbing user
        console.log('incomingCall ', callState, ' and ', NO_CALL);
        if (callState != NO_CALL) {
            var response = {
                id: 'incomingCallResponse',
                from: message.from,
                callResponse: 'reject',
                message: 'bussy'

            };
            return $scope.sendKMessage(response);
        }

        $scope.showVideo = true;
        $scope.openVoice = true;
        console.log('incomingCall ', message.userData);
        $scope.setCallState(PROCESSING_CALL);

        // if ('serviceWorker' in navigator) {
        //     send(message.userData.callerName +' is calling').catch(err => console.log('incomingCall ',err));
        // }
        $scope.toggleBtn(true);
        //$scope.busy               = true;

        //$scope.reveiveGroupCall   = false;
        $scope.receiveGroupCallId = ''
        $scope.callerId = message.userData.callerId;
        $scope.friendId = message.userData.friendId;
        $scope.callType = message.userData.callType;
        $scope.audio.loop = true;
        $scope.audio.play();
        document.getElementById('incommingCall').style.display = 'block';
        document.getElementById('callerName').innerHTML = message.userData.callerName;
        $scope.inComCallData = message;

        if ($scope.callType == 1) $scope.timmerObj = new timmer('#audioTimmer');
        else $scope.timmerObj = new timmer('#timmer');
    }

    $scope.startCall = function () {
        let localAsset = document.getElementById('local-video');
        let remoteAsset = document.getElementById('videoOutput');
        let medConst = {};

        if ($scope.callType == 1) {
            localAsset = document.getElementById('audioInput');
            remoteAsset = document.getElementById('audioOutput');
            medConst = {
                mediaConstraints: {
                    audio: true,
                    video: false
                }
            };
        }
        var options = {
            localVideo: localAsset,
            remoteVideo: remoteAsset,
            onicecandidate: onIceCandidate, medConst
        }
        $scope.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options,
            function (error) {
                if (error) {
                    console.error(error);
                    $scope.setCallState(NO_CALL);
                }

                this.generateOffer(function (error, offerSdp) {
                    if (error) {
                        console.error(error);
                        $scope.setCallState(NO_CALL);
                    }

                    var response = {
                        id: 'incomingCallResponse',
                        from: $scope.inComCallData.from,
                        callResponse: 'accept',
                        sdpOffer: offerSdp
                    };
                    $scope.sendKMessage(response);
                });
            });
    }

    $scope.stopCall = function () {
        var response = {
            id: 'incomingCallResponse',
            from: $scope.inComCallData.from,
            callResponse: 'reject',
            message: 'user declined'
        };
        $scope.sendKMessage(response);
        $scope.stopK(true);
    }

    function videoKCall(from, to, userData, isAudio) {
        $scope.setCallState(PROCESSING_CALL);
        let localAsset = document.getElementById('local-video');
        let remoteAsset = document.getElementById('videoOutput');
        let medConst = {};

        if (isAudio == 1) {
            localAsset = document.getElementById('audioInput');
            remoteAsset = document.getElementById('audioOutput');
            medConst = {
                mediaConstraints: {
                    audio: true,
                    video: false
                }
            };
        }
        var options = {
            localVideo: localAsset,
            remoteVideo: remoteAsset,
            onicecandidate: onIceCandidate, medConst
        }

        console.log('videoKCall ', options);

        $scope.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function (error) {
            if (error) {
                console.error(error);
                $scope.setCallState(NO_CALL);
            }

            this.generateOffer(function (error, offerSdp) {
                if (error) {
                    console.error(error);
                    $scope.setCallState(NO_CALL);
                }

                var message = {
                    id: 'call',
                    from: from,
                    to: to,
                    userData: userData,
                    sdpOffer: offerSdp
                };
                //if(isAudio!=1) message['sdpOffer']=offerSdp;
                //console.log('videoKCall2 ',message);
                $scope.sendKMessage(message);
            });
        });
    }

    function startCommunication(message) {
        $scope.setCallState(IN_CALL);
        $scope.webRtcPeer.processAnswer(message.sdpAnswer);
    }

    $scope.showVideo = true;
    $scope.toggelVideo = function () {
        $scope.showVideo = !$scope.showVideo;
        $scope.webRtcPeer.getLocalStream().getVideoTracks()[0].enabled = $scope.showVideo;
    };

    $scope.openVoice = true;
    $scope.toggelMute = function () {
        $scope.openVoice = !$scope.openVoice;
        $scope.webRtcPeer.getLocalStream().getAudioTracks()[0].enabled = $scope.openVoice;
    };

    // Kurento webrtc functions end================================================
    /*check session of the user if he is logged in or not*/
    $http({
        method: 'GET',
        url: '/get',
        xhrFields: { withCredentials: true }
    }).then(function successCallback(response) {
        $scope.check = function (event) {
            console.log(event.keyCode);
        }
        /*login user */
        /* store video of calling sound*/

        $scope.usersInGroup = 1;
        $scope.countGroupMembers = 1;
        $scope.groupOrUser = '';
        $rootScope.user = response.data;

        // Registering user with kurento start 
        var jsonMessage = {
            id: 'register',
            name: $rootScope.user._id
        };
        console.log('Registering client: ' + jsonMessage);
        $scope.sendKMessage(jsonMessage);
        //end
        $scope.setCallState(NO_CALL);
        //$scope.busy              = false; // true then the user is on the call
        $scope.chatIsActive = true;
        //$scope.groupIsActive     = false;
        // $scope.reveiveGroupCall  = false;
        $scope.receiveCall = false;
        //$scope.liveStream        = false;
        $scope.welcomePage = true;
        $scope.caller = false;
        $scope.getmembers = [];
        $scope.files = [];
        /*get user image*/
        // $http.get($scope.sbsLink+"api/getUserinfo/"+response.data.userId)
        //     .then(function(response) {
        //     });


        /*get all users*/
        $http.get("/getUsers/" + response.data._id)
            .then(function (response) {
                $scope.allUsers = response.data;
                for (i = 0; i < response.data.length; i++) {
                    if (response.data[i].email != $scope.user.email) {
                        $scope.getmembers.push(response.data[i]);
                    }
                }
            });

        /*get all group users*/
        $http.get("/getcreatedgroups/"+$scope.user._id)
            .then(function (response) {
             // console.log(response);
                $scope.allGroups = response.data;
                // for (i = 0; i < response.data.length; i++) {
                //     if (response.data[i].email != $scope.user.email) {
                //         $scope.getmembers.push(response.data[i]);
                //     }
                // }
            });

        $scope.check = function (user) {
            return user.email != $scope.user.email;
        };
        $scope.remove = function (index) {
            var files = [];
            angular.forEach($scope.files, function (file, key) {
                if (index != key) {
                    files.push(file);
                }
                $scope.files = files;
            })
        }

        $scope.upload = function () {
            var fd = new FormData();
            angular.forEach($scope.files, function (file) {
                fd.append('avatar', file); // when previwe on then file.file
            })
            fd.append('senderId', $scope.user._id);
            fd.append('senderName', $scope.user.name);

            if ($scope.chatIsActive === true) {
               
                fd.append('friendId', $scope.chatWithId);   //chnId 1
                $http.post('/chatFilesShare', fd, {
                    transformRequest: angular.identity,
                    headers: { 'Content-Type': undefined }
                }).then(function (d) {
                    updatechat();
                })
            }
            // else if ($scope.chatIsActive === false && $scope.groupeIsActive === true){
            //      console.log("group");
            // }
            else {
                fd.append('id', $scope.connectionId);
                fd.append('name', $scope.user.name);
                $http.post('/groupFilesShare', fd, {
                    transformRequest: angular.identity,
                    headers: { 'Content-Type': undefined }
                }).then(function (d) {
                    $http.post('/getgroupchat', { id: $scope.connectionId }).then((res) => {
                        $scope.chats = res.data[0].message;
                        socket.emit('updateGroupFiles', { members: res.data[0].members, messages: res.data[0].message });
                        scrollbottom();
                    })
                })
            }

        }
        socket.on('updateOtherMembersFiles', function (data) {
            $scope.$apply(() => {
                for (var i = 0; i < data.members.length; i++) {
                    if (data.members[i].id == $scope.user._id) {
                        $scope.chats = data.messages;
                    }
                }
            });
        })
        /*get All groups*/
        // $http.get("/getGroups/"+$rootScope.user._id)
        //     .then(function(response) {
        //         $scope.allGroups = response.data;
        //     });
        /*get All notifications*/
        $http.get("/getNotification/" + $rootScope.user._id)
            .then(function (response) {
                $scope.notifications = response.data.noti;
                $scope.notiCount = response.data.count;
            });

        $scope.groupeActive = function () {
            $scope.chatIsActive = false;
            $scope.groupeIsActive = true;
        }

        $scope.chatActive = function () {
           // $scope.groupOrUser = "";
            $scope.groupChat = false;
            $scope.groupeIsActive = false;
            $scope.chatIsActive = true;
        }

        $scope.groupChatActive = function () {
           // $scope.groupOrUser = "";
            $scope.groupChat = true;
            $scope.chatIsActive = false;
            $scope.groupeIsActive = true;
        }

        /*on click on a user this function get chat between them*/
        $scope.startChat = function (obj) {
            $scope.welcomePage = false;
            /*obj is an object send from view it may be a chat or a group info*/
            if (obj.type == 'chat') {
                $scope.sendType = 'chat';
                $scope.groupOrUser = obj.user.name;
                $scope.chatWithImage = obj.user.user_image;
                $scope.chatWithId = obj.user._id;
                socket.emit('change_username', { username: $rootScope.user.name, rcv_id: $scope.chatWithId });
                $scope.status = obj.user.status;
                $scope.connectionId = $scope.chatWithId; //chnId 2

                //chnId 3
                $http.get('/getChat/' + $scope.user._id + '/' + $scope.chatWithId)
                    .then(function (res) {
                        //console.log(res.data);
                        $scope.groupMembers = '';
                        $scope.chats = res.data;
                        scrollbottom();
                    });
            } else {
               //  console.log(obj);
                // console.log(obj.group.name);
               // $scope.user = 'welcome'
                $scope.sendType = 'group';
                $scope.connectionId = obj.group._id;
                $scope.groupOrUser = obj.group.name;
                $scope.status = '';

                $http.get('/getGroup/' + obj.group._id).then(function (groupchat) {
                    console.log(groupchat);
                    $scope.groupchats = groupchat.data;
                    // $scope.groupMembers = groupchat.data[0].members;
                    // $scope.chats = groupchat.data[0].message;
                    scrollbottom();
                })

            }
        }
        $scope.seenNotification = () => {
            $http.post('/notificationseen', { userId: $scope.user._id }).then(function (data) {
                $scope.notiCount = 0;
            });
        }
        /* to show edit menu popup on right click on a message*/
        $scope.editMenu = function (chat) {
            $scope.editMsgIconStatus = true;
            $scope.editMsgId = chat._id;
            $rootScope.editMsgMenu1 = ($rootScope.editMsgMenu1) ? false : true;
            $scope.msgEdit = chat.message;
        }
        /* to edit message */
        $scope.editMsg = function () {
            $scope.edit = true;
            $scope.message = $scope.msgEdit;
            var ele = $('#sendMsg').emojioneArea();
            ele[0].emojioneArea.setText($scope.message);
            $rootScope.editMsgMenu1 = false;
        }
        /* disconnect the call*/
        $scope.leaveRoom = function () {
            $scope.ringbell.pause();
            // webrtc.leaveRoom();
            // webrtc.disconnect();
            // webrtc.stopLocalVideo();
            // webrtc = '';
            $scope.timmerObj.stopCallTimmer();
            //document.querySelector('.liveStreamTab').style.display = 'none';
            document.querySelector('.videoTab').style.display = 'none';
            document.querySelector('.audioTab').style.display = 'none';
        }

        /*disconnect the call from user side who hit the disconnect button*/
        $scope.disconnect = function (friendId) {
            //$scope.busy = false;
            $scope.setCallState(NO_CALL);
            $scope.receiveCall = false;
            $scope.leaveRoom();
            $scope.toggleBtn(false);
            if ($scope.caller == true) {
                $scope.callCancelTimmer.stopCallTimmer();
                $scope.caller = false;
            }
            //console.log(friendId,' hm ',$scope.reveiveGroupCall,' hm ',$scope.liveStream);
            if (friendId)
                socket.emit('calldisconnect', { friendId: friendId });
        }
        /*disconnect the call from other side through socket io*/
        socket.on('calldis', function (data) {
            if (data.friendId == $scope.user._id) {
                //$scope.busy = false;
                $scope.setCallState(NO_CALL);
                $scope.toggleBtn(false);
                if ($scope.receiveCall == false) {
                    $scope.audio.pause();
                    document.getElementById('incommingCall').style.display = 'none';
                } else {
                    $scope.leaveRoom();
                    $scope.receiveCall = false;
                }
                $scope.stopK();
            }
        })
        /* send message to the user group and chat both handle in this function through sendType*/
        $scope.sendMessage = function (sendType, message = 0, chkmsg = 0) {
            if (!$scope.message && chkmsg)
                $scope.message = chkmsg;
            else if (!$scope.message && !chkmsg)
                return;

            if (sendType == 'chat') {
                if (message != 0) {
                    $scope.message = 'call duration ' + $scope.timmerObj.showTime();
                   // console.log('$scope.timmerObj ', $scope.timmerObj);
                }

                if ($scope.edit === true) {
                    $http.post('/updateChat/' + $scope.editMsgId, { "message": $scope.message })
                        .then(function (res) {
                            $scope.message = '';
                            $scope.editMsgId = '';
                            $scope.edit = false;
                            updatechat();
                            var ele = $('#sendMsg').emojioneArea();
                            ele[0].emojioneArea.setText('');
                            //scrollbottom();
                        })
                } else {
                    $http.post('/chat', {"isGroup":0, "senderId": $scope.user._id, "senderImage": $scope.user.user_image, "receiverImage": $scope.chatWithImage, "recevierId": $scope.chatWithId, "senderName": $scope.user.name, "message": $scope.message })
                        .then(function (res) {
                            if (res.data.length < 1) return;
                            $scope.message = '';
                           // console.log(res.data);
                            $scope.chats.push(res.data);
                            socket.emit('checkmsg', res.data);
                            /*its a custom made function to scroll down at the end*/
                            scrollbottom();
                            var ele = $('#sendMsg').emojioneArea();
                            ele[0].emojioneArea.setText('');
                        })
                    }

            } else {
                if ($scope.edit === true) {

                    $http.post('/updateGroupChat/' + $scope.editMsgId, { "message": $scope.message, groupId: $scope.connectionId })
                        .then(function (res) {
                            $scope.chats = res.data[0].message;
                            $scope.message = '';
                            $scope.editMsgId = '';
                            $scope.edit = false;
                            var ele = $('#sendMsg').emojioneArea();
                            ele[0].emojioneArea.setText('');
                        })
                } else {
                    
                    $http.post('/groupChat', {"isGroup":1, "senderId": $scope.user._id, name: $scope.user.name, "message": $scope.message, id: $scope.connectionId })
                        .then(function (res) {
                            console.log(res);
                           // $scope.groupchats.push(res.data);
                            var last = res.data.message.length - 1;
                            var data = res.data.message[last];
                            $scope.message = '';
                            //$scope.chats.push(data);
                      //      socket.emit('checkmsg', res.data);
                            socket.emit('updateGroupChat', { id: res.data._id, data: res.data });
                            //socket.emit('checkmsg', { id: res.data._id, data: data });
                            scrollbottom();
                            var ele = $('#sendMsg').emojioneArea();
                            ele[0].emojioneArea.setText('');
                        })
                }
            }
        }
        /*this array save group members*/
        $scope.members = [];
        /*to create new group*/
        $scope.addgroup = function () {
            $scope.members.push($scope.user);
            $http.post('/addgroup', { 'groupName': $scope.groupName, 'members': $scope.members }).then(function (res) {
                $scope.groupName = '';
                $scope.members = '';
            });
        }

        $scope.disableMsgEdit = function (){
            console.log("a");
            if($scope.editMsgIconStatus)
            $rootScope.editMsgMenu1 = false;
        }
        /* after enter the live stream pass this function call*/
        // $scope.broadcasting = function(type){
        //     //$scope.busy = true;
        //     $scope.liveStream = true;
        //     if( type == 'audio' ){
        //         document.querySelector('.audioTab').style.display = 'block';
        //     }else{
        //         document.querySelector('.videoTab').style.display = 'block';
        //     }
        //     createRoom(type,$scope.liveStreamCode,1);
        //     socket.emit('broadcasting',{userName:$scope.user.name,userId:$scope.user._id,callType:type});

        // }
        // socket.on('receiveBroadcasting',function(data){
        //     if($scope.busy == false){
        //         $scope.liveUserName = data.userName;
        //         $scope.liveUserId   = data.userId;
        //         $scope.callType     = data.callType;
        //         if( $scope.liveUserId != $scope.user._id )
        //             if ('serviceWorker' in navigator) {
        //                 send(data.userName + ' is live now').catch(err => console.error(err));
        //             }
        //             $('#joinbbtn').trigger('click');
        //     }

        // })

        // $scope.joinbroadcasting = function(){
        //     if( $scope.callType == 'audio' ){
        //         document.querySelector('.audioTab').style.display = 'block';
        //     }else{
        //         document.querySelector('.liveStreamTab').style.display = 'block';
        //     }
        //     joinLiveStream($scope.callType,$scope.joinliveStreamCode);
        //     $scope.busy = true;
        //     $scope.liveStream = true;
        // }

        /*logout the user and destroy the session*/
        $scope.logout = function () {
            //$http.get($scope.sbsLink+"setChatStatus/2/"+$scope.userEmailId+"/0"); //set logout
            $http.get('/logout').then(function (res) {
                if (res.data.msg == "session destroy") {
                    $scope.user = undefined;
                    $location.path('/');
                }
            })
        }
        /* this function enable or disable the btns when the call receive or drop*/
        $scope.toggleBtn = function (bolean) {
            $('#call').prop('disabled', bolean);
            $('#videoCall').prop('disabled', bolean);
            $('#live').prop('disabled', bolean);
        }

        /* video calling functionality*/
        $scope.videoCall = function (type, callerId) {

            if (type == 1) {
                $scope.timmerObj = new timmer('#audioTimmer');
                document.querySelector('.audioTab').style.display = 'block';
            }
            else {
                $scope.timmerObj = new timmer('#timmer');
                document.querySelector('.videoTab').style.display = 'block';
            }

            $scope.toggleBtn(true);
            //$scope.busy   = true; // it means the user is on a call no one call this user this time 
            $scope.caller = true;
            $scope.ringbell.loop = true;
            $scope.ringbell.play();
            if ($scope.chatIsActive == true) {
                $scope.showVideo = true;
                $scope.openVoice = true;
                console.log('from ', $scope.user._id, ' to ', $scope.chatWithId);
                let userData = { friendId: $scope.chatWithId, callerName: $scope.user.name, callerId: $scope.user._id, callType: type };
                videoKCall($scope.user._id, $scope.chatWithId, userData, type);
                $scope.callCancelTimmer = new timmer('#checker');
                $scope.callCancelTimmer.startCallTimmer();
                //createRoom(type,""+$scope.user.userId+$scope.chatWith);
                /* emit an socket io event to slow incoming call popup to friend*/
                //socket.emit('videoCall',{friendId:$scope.chatWith,callerName:$scope.user.name,callerId:$scope.user.userId,callType:type});
            }

            // if( $scope.groupeIsActive == true ){
            //     createRoom( type, $scope.connectionId );
            //     socket.emit('groupvideoCall',{members:$scope.groupMembers,groupName:$scope.groupOrUser,groupId:$scope.connectionId,callerId:$scope.user._id,callType:type});
            // }
        }
        /* this is the main function call after time up and no one receive the call*/
        $scope.dropCall = function () {
            // if($scope.reveiveGroupCall == true){
            //     $scope.dropGroupCallAfterTime($scope.groupMembers,$scope.user._id);
            // }else{
            $scope.callDropAfterTime($scope.chatWithId, $scope.user._id);
            //}
        }
        /* this function drop the group call after times up and no one receive call*/
        $scope.dropGroupCallAfterTime = function (members, callerId) {
            //$scope.busy = false;
            $scope.setCallState(NO_CALL);
            $scope.toggleBtn(false);
            $scope.leaveRoom();
            socket.emit('dropTheGroupCall', { members, members, callerId: callerId });
        }
        /* this function drop the call after times up and no one receive call*/
        $scope.callDropAfterTime = function (friendId, callerId) {
            //$scope.busy = false;
            $scope.setCallState(NO_CALL);
            $scope.toggleBtn(false);
            $scope.leaveRoom();
            socket.emit('dropTheCall', { friendId, friendId, callerId: callerId });
        }
        /* drop the call of group members when the times up and no one receive the call*/
        // socket.on('dropeTheMembersCall',function(data){
        //     $scope.$apply(function(){
        //         for( var i = 0; i < data.members.length; i++ ){
        //             if(data.members[i].id == $scope.user._id){
        //                 $scope.busy = false;
        //                 $scope.toggleBtn(false);
        //                 document.getElementById('incommingCall').style.display = 'none';
        //                 $scope.audio.pause();
        //             }
        //         }
        //         if(data.callerId == $scope.user._id){
        //             $.toaster({ priority : 'danger', title : 'call drop', message : 'group call due to time up no one reveive the call'});
        //             callCancelTimmer.stopCallTimmer();
        //             console.log('Calling stop from 1');
        //             $scope.stopK();
        //         }
        //     });
        // })
        /* drop the call then the user not receive the call and times up*/
        socket.on('dropeTheFriendCall', function (data) {
            $scope.$apply(function () {
                if (data.friendId == $scope.user._id) {
                    //$scope.busy = false;
                    $scope.setCallState(NO_CALL);
                    $scope.toggleBtn(false);
                    document.getElementById('incommingCall').style.display = 'none';
                    $scope.audio.pause();
                }
                if (data.callerId == $scope.user._id) {
                    $.toaster({ priority: 'danger', title: 'call drop', message: 'call drop due to time up' });
                    $scope.callCancelTimmer.stopCallTimmer();
                    console.log('Calling stop from 2');
                    $scope.stopK();
                }
            });
        })

        // socket.on('reveiceGroupVideoCall',function(data){
        //     for(var i = 0;i < data.members.length; i++){
        //         if ('serviceWorker' in navigator) {
        //             send('you have a groupcall ' + data.groupName ).catch(err => console.error(err));
        //         }
        //         $scope.toggleBtn(true);
        //         $scope.countGroupMembers  = 1;
        //         $scope.busy               = true;
        //         $scope.reveiveGroupCall   = true;
        //         $scope.receiveGroupCallId = data.groupId;
        //         $scope.receiveGroupMem    = data.members;
        //         $scope.callType           = data.callType;
        //         $scope.callerId           = data.callerId;
        //         if( data.members[i].id == $scope.user._id && data.members[i].id != data.callerId ){
        //             $scope.audio.loop                = true;
        //             $scope.audio.play();
        //             document.getElementById('incommingCall').style.display = 'block';
        //             document.getElementById('callerName').innerHTML = data.groupName;
        //             $scope.connectUsers('countGroupMembers');
        //         }
        //     }
        // })
        /* this function increase the user then he join the group*/
        $scope.connectUsers = function (check) {
            // if ( $scope.reveiveGroupCall == true ) 
            // socket.emit('connectUsers',{check:check,members:$scope.receiveGroupMem});
        }
        socket.on('updateConnectedUsers', function (data) {
            for (var i = 0; i < data.members.length; i++) {
                if (data.members[i].id == $scope.user._id) {
                    $scope.$apply(function () {
                        if (data.check == 'countGroupMembers') {
                            $scope.countGroupMembers += 1;
                        } else {
                            $scope.usersInGroup += 1;
                        }
                    })
                }
            }
        })
        /* this function downgrade the user when he left the group */
        $scope.removeconnectUser = function (check) {
            // if ( $scope.reveiveGroupCall == true && $scope.liveStream === false) 
            // socket.emit('removeconnectUser',{check:check,members:$scope.receiveGroupMem});
        }
        socket.on('deductConnectedUser', function (data) {
            for (var i = 0; i < data.members.length; i++) {
                if (data.members[i].id == $scope.user._id) {
                    $scope.$apply(function () {
                        $scope.countGroupMembers -= 1;
                        if (data.check == 'afterReceive') {
                            $scope.usersInGroup -= 1;
                            if ($scope.usersInGroup == 1) {
                                if ($scope.callerId == $scope.user._id) {
                                    //$scope.busy = false;
                                    $scope.setCallState(NO_CALL);
                                    $scope.toggleBtn(false);
                                    $scope.leaveRoom();
                                }
                            }

                        }

                    })
                }
            }
        })
        /* show incomming call popup and caller name */
        // socket.on('videoCallToFriend',function(data){
        //     // && $scope.busy == false
        //     if( data.friendId == $scope.user.userId ){
        //         if ('serviceWorker' in navigator) {
        //             send(data.callerName +' is calling').catch(err => console.log('videoCallToFriend ',err));
        //         }
        //         $scope.toggleBtn(true);
        //         $scope.busy               = true;
        //         $scope.reveiveGroupCall   = false;
        //         $scope.receiveGroupCallId = ''
        //         $scope.callerId           = data.callerId;
        //         $scope.friendId           = data.friendId;
        //         $scope.callType           = data.callType;
        //         $scope.audio.loop                = true;
        //         $scope.audio.play();
        //         document.getElementById('incommingCall').style.display = 'block';
        //         document.getElementById('callerName').innerHTML = data.callerName;
        //     }
        //     // else if( data.friendId == $scope.user.userId && $scope.busy == true ){
        //     //     socket.emit('busy',data);
        //     // }
        // })
        /*show alert to the user that the person are busy on another call*/
        socket.on('userBusy', function (data) {
            if (data.callerId == $scope.user._id) {
                $scope.toggleBtn(false);
                $.toaster({ priority: 'danger', title: 'call drop', message: 'The person you are trying to call is busy at the moment' });
                webrtc = '';
                $scope.callCancelTimmer.stopCallTimmer();
                $scope.ringbell.pause();
                document.querySelector('.videoTab').style.display = 'none';
                document.querySelector('.audioTab').style.display = 'none';
                console.log('Calling stop from 3');
                $scope.stopK();
            }

        })
        /* delete message chat and group both handle in this function*/
        $scope.deleteMsg = function (type) {
            if ($scope.sendType == 'chat')
                $scope.callModal({ 'type': 2, 'id': $scope.editMsgId, 'type2': type });
            else
                $scope.callModal({ 'type': 3, 'id': $scope.editMsgId, 'type2': type, 'connId': $scope.connectionId });
        }
        /* update chat after performing any action on reall time*/
        function updatechat(deletedItem) {
            $http.get('/getChat/' + $scope.user._id + '/' + $scope.chatWithId)
                .then(function (res) {
                    $scope.groupMembers = '';
                    $scope.chats = res.data;
                   
                    socket.emit('updatechat', res.data);
                });
        }

        // var confirmModal = this;
        // confirmModal.data = "Lorem Name Test";
        // console.log('pc.data ',confirmModal.data);
        // confirmModal.open = function (size) {

        // };
        /* remove user then click on cross button*/
        $scope.removeUser = (id) => {
            var obj = { 'type': 1, 'id': id };
            $scope.callModal(obj);
        }

        $scope.callModal = function (obj) {
            $scope.modalObject = obj;
            $scope.modalInst = $uibModal.open({
                animation: true,
                ariaLabelledBy: 'modal-title',
                ariaDescribedBy: 'modal-body',
                templateUrl: 'views/templates/modal.html',
                controller: 'dashController',
                // controllerAs: 'pc', 
                resolve: {
                    data: function () {
                        return obj;
                    }
                }
            });
            $scope.modalInst.result.catch(function error(error) {
                console.log('error!: ', error);
                if (error === "backdrop click") {
                    // do nothing
                } else {
                    throw error;
                }
            })

            $scope.modalInst.result.then(function (result) {
                let id = $scope.modalObject['id'];
                let type = $scope.modalObject['type'];
                if (type == 1)
                    $http.post('/removeUser', { 'id': id }).then(function (d) {
                        $.toaster({ priority: 'danger', title: 'User deleted', message: 'User and its related chat deleted' });
                        $scope.welcomePage = true;
                        $http.get("/getUsers/" + $scope.user._id)
                            .then(function (response) {
                            
                                $scope.allUsers = response.data;
                            });
                    });
                else if (type == 2)
                    $http.get('/deleteMsg/' + id + '/' + $scope.modalObject['type2']).then(function (res) {
                        updatechat(res);
                        $scope.editMsgId = '';
                        $rootScope.editMsgMenu1 = false;
                    })
                else if (type == 3)
                    $http.get('/deleteGroupMsg/' + id + '/' + $scope.modalObject['type2'] + '/' + $scope.modalObject['connId']).then(function (res) {
                        $scope.editMsgId = '';
                        $rootScope.editMsgMenu1 = false;
                        socket.emit('updateGroupChat', res.data[0].message);
                    })
            });

            return $scope.modalInst
        }

        /* this function join the call when the user receive the call*/
        $scope.joinCall = function () {
            if ($scope.callType == 1)
                document.querySelector('.audioTab').style.display = 'block';
            else
                document.querySelector('.videoTab').style.display = 'block';

            // if( $scope.reveiveGroupCall == true ){
            //     // joinRoom($scope.callType,$scope.receiveGroupCallId);
            //     // if( $scope.usersInGroup <= 1 )
            //     //     socket.emit('callStart',{friendId:$scope.user.userId,callerId:$scope.callerId});
            //     // else{
            //     //     $scope.timmerObj.reset();
            //     //     $scope.timmerObj.startCallTimmer();
            //     // }
            // }else{
            /*custom function to join the room simple webrtc*/
            //joinRoom($scope.callType,""+$scope.callerId+$scope.user.userId);
            //$scope.chatWith = $scope.callerId;
            socket.emit('callStart', { callerId: $scope.callerId, friendId: $scope.friendId });
            $scope.startCall();
            //}
            document.getElementById('incommingCall').style.display = 'none';
            $scope.audio.pause(); // stop the ring after receive
            $(".ringingBell").addClass('hidden');
        }
        /* drop call means user did not receive the call and cancel it */
        $scope.callDrop = function (check) {
            $scope.toggleBtn(false);
            //$scope.busy = false;
            $scope.setCallState(NO_CALL);
            document.getElementById('incommingCall').style.display = 'none';
            $scope.audio.pause();
            // if( $scope.reveiveGroupCall == false ){
            //     socket.emit('dropCall',{callerId:$scope.callerId,type:"call"});
            //     $scope.stopCall();  
            // }else{
            $scope.removeconnectUser(check);
            setTimeout(() => {
                if ($scope.countGroupMembers == 1) {
                    socket.emit('dropCall', { callerId: $scope.callerId, type: 'group' });
                }
            }, 1000);

            // }
        }
        socket.on('callDroped', function (data) {
            if (data.callerId == $scope.user._id) {
                $scope.toggleBtn(false);
                $scope.leaveRoom();
                $scope.callCancelTimmer.stopCallTimmer();
                $scope.ringbell.pause();
                if (data.type == 'call')
                    $.toaster({ priority: 'danger', title: 'call drop', message: 'The person you call is busy at the moment' });
                if (data.type == 'group')
                    $.toaster({ priority: 'danger', title: 'call drop', message: 'no one pick the call' });

                console.log('Calling stop from 4');
                $scope.stopK();
            }
        })
        /* update the chat of the friend side after any action*/
        socket.on('updateChatAll', (conversation) => {
            var recevierId = conversation.length >= 0 ? conversation[0].recevierId : conversation.recevierId;
            var senderId = conversation.length >= 0 ? conversation[0].senderId : conversation.senderId;
            $scope.$apply(function () {
                if ($scope.user._id == recevierId && $scope.chatWithId == senderId || $scope.user._id == senderId && $scope.chatWithId == recevierId) {
                    if (conversation.length >= 0) {
                        $scope.chats = conversation;
                    } else {
                        $scope.chats = [];
                    }
                    scrollbottom();
                }
            });
        })

        /*update the new message friend side */
        socket.on('remsg', function (msg) {
            $scope.$apply(function () {
                if ($scope.user._id == msg.recevierId && $scope.chatWithId == msg.senderId) {
                    $scope.chats.push(msg);
                    scrollbottom();
                }
                if ($scope.user._id == msg.recevierId) {
                    var audio2 = new Audio('audio/message.mp3');
                    audio2.play();
                    // if ('serviceWorker' in navigator) {
                    //     send(msg.senderName + ' send a new message').catch(err => console.error(err));
                    // }else{
                    //     alert('service worker not support');
                    // }
                }

                if (msg.id == $scope.connectionId) {
                    $scope.chats.push(msg.data);
                    scrollbottom();
                }
            });
        });
        // socket.on('getUsers',function(users){
        // 	$scope.$apply(function(){
        //         // if(users.senderId == $scope.user.userId)
        // 		//     $scope.allUsers = users.senderUsers;
        //         // else if(users.receiverId == $scope.user.userId)
        //         //     $scope.allUsers = users.receiverUsers; 
        //             $scope.allUsers=users;
        //         console.log('2- $scope.allUsers ',$scope.allUsers);
        // 	});
        // })
        // socket.on('groupUpdate',function(groups){
        //     $scope.$apply(function(){
        //         $scope.allGroups = groups;
        //     });
        // })
        socket.on('updateAllGroupChat', function (chats) {
            $scope.$apply(function () {
               // $scope.groupchats = chats;
               console.log(chats.data);
               //if (msg.id == $scope.connectionId) {
                $scope.groupchats.push(chats.data);
             //  }
                scrollbottom();
            });
          
        })

        socket.on('startTimmer', function (data) {
            console.log(data.callerId, ' and ', $scope.user._id, ' and ', data.friendId);
            if (data.callerId == $scope.user._id || data.friendId == $scope.user._id) {
                $scope.timmerObj.reset();
                $scope.receiveCall = true;
                $scope.timmerObj.startCallTimmer();
                console.log('Timer started');
            }
            if (data.callerId == $scope.user._id) {
                $scope.ringbell.pause();
                $scope.callCancelTimmer.stopCallTimmer();
            }
            $(".ringingBell").addClass('hidden');
        });
        $scope.onExit = function () {
            $http.get('/changeStatus').then(function (res) {
                return ('bye bye');
            })
        };

        $window.onbeforeunload = $scope.onExit;

    }, function errorCallback(response) {
        $scope.sessionDestroy = true;
    });

    $scope.showHideDots = function (id, isShow = 0) {
        if (isShow == 1) $("#msg3dots-" + id).removeClass('hidden');
        else $("#msg3dots-" + id).addClass('hidden');
    };

    $scope.imgStDrop = function (isShow = 0) {
        if (isShow == 1) $(".stAngleDd").removeClass('hidden');
        else $(".stAngleDd").addClass('hidden');
    };

    $scope.stArr = ['activeSt', 'awaySt', 'dDisturbSt', 'invisSt'];
    $scope.changeSt = function (val = 0) {
        $scope.currSt = val;
        $scope.stClass = $scope.stArr[$scope.currSt];
        //getgroupchat
        console.log('val :', val);
        $http.post('/setPerStatus', { pStatus: val }).then((res) => {
            if (res.status) console.log('Changed');
        });

        // if($scope.userEmailId)
        //     $http.get($scope.sbsLink+"setChatStatus/1/"+$scope.userEmailId+"/"+val);
    }

    $scope.userEmailId = 0;
    $scope.checkStatus = function () {
        $http.get('/checkPerStatus').then((res) => {
            if (res.status) {
                $scope.currSt = res.data.pStatus;
                $scope.stClass = $scope.stArr[$scope.currSt];
                $scope.userEmailId = res.data.email;
                // $http.get($scope.sbsLink+"setChatStatus/2/"+$scope.userEmailId+"/1"); //set online
                // $http.get($scope.sbsLink+"setChatStatus/1/"+$scope.userEmailId+"/"+res.data.pStatus);
            }
        });
    }
    $scope.checkStatus();

    $scope.showDDwnSt = function () {
        $scope.showDrpDwnSt = !$scope.showDrpDwnSt;
    }

    var everywhere = angular.element(window.document);
    everywhere.bind('click', function (event) {
        var isButtonClick = $(event.target).is('.stAngleDd');
        if (!isButtonClick) $scope.showDrpDwnSt = false;
    });

    //Listen on typing
    socket.on('typingRec', (data) => {
       // console.log('typingRec ', data.rcv_id, ' and ', $rootScope.user._id);
        if ($rootScope.user._id == data.rcv_id) {
            $("#isTyping").removeClass('hidden');
            $("#isTyping").html(data.username + " is typing...");
            startHideTimer();
        }
    });

    function startHideTimer() {
        setTimeout(function () {
            $("#isTyping").addClass('hidden');
        }, 5000);
    }
});