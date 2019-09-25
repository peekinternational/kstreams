/*
* author  => Peek International
* designBy => Peek International
*/
app.controller("loginController", function ($scope, $http, $location, $rootScope,$websocket) {
    $scope.notAuthorize = false; // show invalid username password message
    //$scope.testProjectId = "5d4c07fb030f5d0600bf5c03"; //5d4c07fb030f5d0600bf5c03
    $rootScope.projectData=[];
    user={};
    var socket = io.connect();

    $http.post("/getProject").then(function (response) {
        $rootScope.projectData = response.data;  
        //console.log('$rootScope.projectData ', $rootScope.projectData);

        // let hostIs = location.host.split(':');
        // let webSocketIp =  $rootScope.projectData.domainUrl;  //localhost || www.jobcallme.com 
        // if(hostIs[0]=='localhost') webSocketIp='127.0.0.1';
        // let reqUrl='wss://'+webSocketIp+':8443/one2one';
        // let broadCastUrl='wss://'+webSocketIp+':8444/one2many';
        // console.log('WebSocket: ',reqUrl);
        
        // $rootScope.O2OSoc= $websocket.$new(reqUrl); 
        // $rootScope.O2MSoc= $websocket.$new(broadCastUrl);
        // $rootScope.O2MSoc.$on('$open', function () {
        //     console.log('O2M socket open'); 
        // })
        // .$on('$message', function (message) { // it listents for 'incoming event'
        //     var parsedMessage = JSON.parse(message);  

        //     switch (parsedMessage.id) {
        //         case 'presenterResponse':
        //             One2ManyCall.presenterResponse(parsedMessage);
        //             break;
        //         case 'viewerResponse':
        //             One2ManyCall.viewerResponse(parsedMessage);
        //             break;
        //         case 'stopCommunication':
        //             One2ManyCall.dispose();
        //             break;
        //         case 'iceCandidate':
        //             $rootScope.webRtcO2MPeer.addIceCandidate(parsedMessage.candidate)
        //             break;  
        //         case 'presenterDataResp': 
        //                 if(!$rootScope.user) break;
        //                 let presenterData=[];
                        
        //                 parsedMessage.data.forEach(preData => {
        //                     if(preData.preId!=$rootScope.user._id) presenterData.push(preData)
        //                 }); 
                      
        //                 $rootScope.presenterArr=presenterData;
        //         break;
        //         default:
        //             console.error('Unrecognized message', parsedMessage);
        //     }
        // });
        
    });
    
    /*check session*/
    $http({
        method: 'GET',
        url: '/checkSession',
    }).then(function successCallback(response) { 
        $rootScope.user = response.data;
        socket.emit('logoutUpdate', $scope.loggedUserId);
        $location.path("/screenshare");
    });

    /*login function*/
    $scope.login = function () {
      //  console.log($scope.email);
        $http({
            method: 'POST',
            url: '/login',
            data: { email: $scope.user.email, password: $scope.user.password }
        }).then(function successCallback(response) {
            $rootScope.user = response.data;
            //$rootScope.activeUserPanel = '';
            $location.path("/screenshare");
        }, function errorCallback(response) {
            $scope.notAuthorize = true;
        });
    }

});