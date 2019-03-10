

var bot_api = apigClientFactory.newClient(); //instantiates an API gateway SDK object
var messages = []  //array that hold the record of each string in chat
  lastUserMessage = "", //keeps track of the most recent input string from the user
  botMessage = "", //var keeps track of what the chatbot is going to say
  botName = 'Mr. Concierge', //name of the chatbot
  userName = "Me",
  talking = true; //when false the speach function doesn't work


$(document).ready(function () {

  $("#signin").click(function(){
    if ($('#email').val() == "" || $('#password').val() == "") {
      alert("Fill All Fields !");
      } else {
      var username = $('#email').val()
      var pw = $('#password').val()
      sign_in(username, pw)
      }
  });
  $("#signup").click(function(){
    if ($('#email').val() == "" || $('#password').val() == "") {
      alert("Fill All Fields !");
      } else {
      var username = $('#email').val()
      var pw = $('#password').val()
      sign_up(username, pw)
      }
  });

  function login_confirm(verified, error){
    if( verified ){ 
      div_hide(); 
    }
    else{ 
      new_user_callback(null, error)
    }  
  }
    
    //Function To Display Popup
    function div_show() {
    document.getElementById('popup').style.display = "block";
    }
    //Function to Hide Popup
    function div_hide(){
    document.getElementById('popup').style.display = "none";
    $('#popup').hide();
    }

  function new_user_callback(username, error){
    if (error){
      $("#logininfo").text(error)
    }
    else{
    $("#logininfo").text("")
    $("#logininfo").text("Welcome, " +username+ ", please press 'Sign In'")
    }
  }

  function sign_in(email, password){

    var authenticationData = {
      Username : email,
      Password : password,
    };
    var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    var poolData = { UserPoolId : 'us-west-2_Wu6RLcmDo',
      ClientId : '1ieea9f4anfeprffrs0nq2k3bq'
    };
    var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    var userData = {
      Username : email,
      Pool : userPool
    };
    var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: function (result) {
          var accessToken = result.getAccessToken().getJwtToken();
          /* Use the idToken for Logins Map when Federating User Pools with identity pools or when passing through an Authorization Header to an API Gateway Authorizer*/
          var idToken = result.idToken.jwtToken;
          login_confirm(true, null)
      },
      onFailure: function(err) {
          login_confirm(false, "Invalid email or password.")
  
      },
  });
  }

  function sign_up(email, password){
    var authenticationData = {
      Username : email,
      Password : password,
    };
    var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    var poolData = { UserPoolId : 'us-west-2_Wu6RLcmDo',
      ClientId : '1ieea9f4anfeprffrs0nq2k3bq'
    };
    var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    var attributeList = [];

    var dataEmail = {
    Name: 'email',
    Value : email
    };

  var attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute(dataEmail);
  console.log(attributeEmail)
  attributeList.push(attributeEmail);

  userPool.signUp(email, password, attributeList, null, function(err, result){
    if (err) {
        new_user_callback(null, "Invalid email or password.");
        return;
    }
    cognitoUser = result.user;
    new_user_callback(username, null)
  });

} 
  //runs the keypress() function when a key is pressed
  document.onkeypress = keyPress;
  //if the key pressed is 'enter' runs the function newEntry()
  function keyPress(e) {
    var x = e || window.event;
    var key = (x.keyCode || x.which);
    if (key == 13 || key == 3) {
      //runs this function when enter is pressed
      newEntryPair();
    }
  }

  function newEntryPair() {
    //if the message from the user isn't empty then run 
    if (document.getElementById("chatbox").value != "") {

      //pulls the value from the chatbox ands sets it to lastUserMessage
      lastUserMessage = document.getElementById("chatbox").value;

      //adds the last user message to the chat log
      addToChatLog(userName, lastUserMessage);

      //get the bot response and send to addToChatLog()
      chatbotResponse(lastUserMessage);
    
      //sets the chat box to be clear
      document.getElementById("chatbox").value = ""; 
    }
  }

  function chatbotResponse(usermsg) {        
    var params, additionalParams = {} 
    var body = 
    { 
      "messages" : {
        "type" : "array",
        "message": usermsg,
        "items" : {
          "$ref":"https://apigateway.amazonaws.com/restapis/j44qot3hqh/models/Message"
        }
      } 
    }
    //calls the POST method from API gateway SDK
    bot_api.chatbotPost(params, body, additionalParams)
      .then(function(response){ 
        botMessage = response.data.body
        //add the last bot message to the chat log
        console.log(response)
        addToChatLog(botName, botMessage )
      })
      .catch(function(request, status, error){
        console.log("Error");
        console.log(request)
        console.log(status)
        console.log(error)
      });
  }
  

  function addToChatLog(name, message){
    if(message.indexOf("Okay, ") >= 0){
      var testarr = message.split('+++')
      for(var i =0; i<testarr.length-1; i++){
        if ($.inArray(testarr[i], "http")){
          messages.push("<b>" + botName + ":</b> " + testarr.splice(i, 1))      
        }
      }
      var names = []
      for(var i=0; i<testarr.length; i++){
        testarr[i].replace(/,/g, "");
        names.push(testarr[i].split('***'))
      }
      for(var i=0; i<names.length-1;i++){
          addImage(names[i][0], i)
          addNames(names[i][1], i)
      }
    }


    else{
    // if(name == botName) { Speech(message) }
    // if(name == userName) { Speech(message) }
    messages.push("<b>" + name + ":</b> " + message)
    }
    for (var i = 1; i < 8; i++) {
      if (messages[messages.length - i])
        document.getElementById("chatlog " + i).innerHTML = messages[messages.length - i];
    }  
  }

  function addImage(image, i){
    var img = '    <img src='+image+' width="300" height="300">';
    $('#images'+i+'').append(img)
  }

  function addNames(name, i){
    $('#names'+i+'').append(name)
  }
});

function placeHolder() {
  document.getElementById("chatbox").placeholder = "";
}

//text to Speech
function Speech(say) {
  if ('speechSynthesis' in window && talking) {
    var utterance = new SpeechSynthesisUtterance(say);
    //msg.voice = voices[10]; // Note: some voices don't support altering params
    //msg.voiceURI = 'native';
    //utterance.volume = 1; // 0 to 1
    //utterance.rate = 0.1; // 0.1 to 10
    //utterance.pitch = 1; //0 to 2
    //utterance.text = 'Hello World';
    //utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  }
}