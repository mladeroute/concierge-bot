

const badimgsource = "./ref/no_image_placeholder.png"
//instantiates an API gateway SDK object
var messages = []  //array that hold the record of each string in chat
  lastUserMessage = "", //keeps track of the most recent input string from the user
  botMessage = "", //var keeps track of what the chatbot is going to say
  botName = 'Mr. Concierge', //name of the chatbot
  userName = "Me",
  talking = true; //when false the speach function doesn't work

//Config AWS credentials for the identifiy pool
AWS.config.region ="us-west-2"
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: 'us-west-2_Wu6RLcmDo' 
});
//Instantiate new API gateway object
var bot_api = apigClientFactory.newClient({
  accessKey: AWS.config.credentials.accessKeyId, 
  secretKey: AWS.config.credentials.secretAccessKey, 
});

$(document).ready(function () {
  //these functions deal with signing in/up in the login popup
  $('#email').focus()
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
  //this function is called back from cognito and hides the login popup
  function login_confirm(verified, access, id, error){
    if( verified ){ 
      div_hide();
      bot_api.config.sessionToken = id;  
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

  //this handles login-related messages in the login popup
  function new_user_callback(username, error){
    if (error){
      $("#logininfo").text(error)
    }
    else{
    $("#logininfo").text("")
    $("#logininfo").text("Welcome, " +username+ ", please press 'Sign In'")
    }
  }

  //this function deals with singing the user into cognito
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
          login_confirm(true, accessToken, idToken, null)
          
      },
      onFailure: function(err) {
          login_confirm(false, null, null, "Invalid email or password.")
  
      },
  });
  }
  //this function deals with singing a new user up for cognito
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
    var attributeList = []; //attribute list will be sent to make a new cognito identity
    var dataEmail = {
    Name: 'email',
    Value : email
    };

  var attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute(dataEmail);
  console.log(attributeEmail)
  attributeList.push(attributeEmail);

  userPool.signUp(email, password, attributeList, null, function(err, result){
    if (err) {
    }
    //if signup successful, return the email and process the login
    cognitoUser = result.user;
    new_user_callback(email, null)
  });
  } 
  
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
    $("#sug").empty()       
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
        //returns error messages if the POST fails
        console.log("Error");
        console.log(request)
        console.log(status)
        console.log(error)
      });
  }
  
  function addToChatLog(name, message){
    //replacing quotation marks
    temp = message.replace(/"/g, " ")
    message = temp
    //parses the data string and routes the pieces accordingly
    if(message.indexOf("Okay, ") >= 0){
      //clears previous suggestion images/names
      $('#names0').empty();
      $('#names1').empty();
      $('#names2').empty();
      $('#images0').empty();
      $('#images1').empty();
      $('#images2').empty();

      var testarr = message.split('+++')
      for(var i =0; i<testarr.length-1; i++){
        if ($.inArray(testarr[i], "http")){
          if (testarr[i].indexOf("we've found") >= 0){
            var firstsplit = testarr[i].split('+')
            //formatting for the UI
            messages.push("<b>" + botName + ":</b> " + firstsplit[0]) 
            messages.push("<b>" + botName + ":</b> " + firstsplit[1]) 
            testarr.splice(i, 1) 
          }
          else{
          messages.push("<b>" + botName + ":</b> " + testarr.splice(i, 1))  
          }    
        }
      }
      var names = []
      //populates a list of the restaurant names for display in the UI
      for(var i=0; i<testarr.length; i++){
        temp = testarr[i].replace(/,/g, "");
        names.push(temp.split('***'))
      }
      //routes image links and names to the UI to be displayed
      for(var i=0; i<names.length;i++){
          if (names[i][0] && names[i][1]){
          addImage(names[i][0], i)
          addNames(names[i][1], names[i][2], i)
          }
      }
      //this appears once the suggestions have been recieved from Lambda
      $("#sug").append("Suggestions below. Click the restaurant name to link to their Yelp page")
      }
    else{
      // if(name == botName) { Speech(message) }
      // if(name == userName) { Speech(message) }
      messages.push("<b>" + name + ":</b> " + message)
      }
    for (var i = 1; i < 8; i++) { // this function adds the messages to the UI
      if (messages[messages.length - i])
        document.getElementById("chatlog " + i).innerHTML = messages[messages.length - i];
    }  
      $("#chatborder").scrollTop = $("#chatborder").scrollHeight;
  }
  //this function deals with adding the suggestion images to the UI
  function addImage(image, i){
    var img = '    <img src='+image+' width="80%" height="25%">';
    var tmpdiv = '<div class = "grayborder fluid">'+img+'</div'
    $('#images'+i+'').append(tmpdiv)
    $('#images'+i+'').onerror = function(){
      var noimg = '    <img src='+badimgsource+'>';
      var tmpdiv = '<div class = "grayborder fluid">'+noimg+'</div'
      $('#images'+i+'').append(tmpdiv)
    }
  }
  //this function deals with adding the names to the UI
  function addNames(name, url, i){
    namelink = "<a title= "+name+" href="+url+">"+name+"</a>"
    $('#names'+i+'').append(namelink)
  }
  });
//clears UI chatbot placeholder
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