var auth = { 
  //
  // Update with your auth tokens.
  //
    consumerKey: "wCDI3cCWcp2xoepcrAdE5Q", 
    consumerSecret: "xthfPXUSNJ4eFa9UkzcvdfTg0bM",
    accessToken: "exuEA22jIXntED-3EYydV6Ap4t8jn5hD",
    // This example is a proof of concept, for how to use the Yelp v2 API with javascript.
    // You wouldn't actually want to expose your access token secret like this in a real application.
    accessTokenSecret: "RGE8GAbXXOgh64MfCKvGPwb6BAs",
    serviceProvider: { 
      signatureMethod: "HMAC-SHA1"  }
};

var terms = 'Mexican';
var near = 'Santa Monica';

var accessor = {
    consumerSecret: auth.consumerSecret,
    tokenSecret: auth.accessTokenSecret
};

parameters = [];
parameters.push(['term', terms]);
parameters.push(['location', near]);
parameters.push(['callback', 'cb']);
parameters.push(['oauth_consumer_key', auth.consumerKey]);
parameters.push(['oauth_consumer_secret', auth.consumerSecret]);
parameters.push(['oauth_token', auth.accessToken]);
parameters.push(['oauth_signature_method', 'HMAC-SHA1']);

var message = { 
    'action': 'http://api.yelp.com/v2/search',
    'method': 'GET',
    'parameters': parameters 
};

OAuth.setTimestampAndNonce(message);
OAuth.SignatureMethod.sign(message, accessor);

//submit button and runs the getData function
$(function(){
  // getData();

  $('form').on("submit", function() {
      // get data from inputs

      terms = $('#terms').val();
      near = $('#near').val();
      
      // replace data in parameters
      parameters.shift();
      parameters.shift();
      parameters.unshift(['location', near]);
      parameters.unshift(['term', terms]);

      //new timestamp for API
      OAuth.setTimestampAndNonce(message);
      OAuth.SignatureMethod.sign(message, accessor);

      // getData
      getData();
      return false

  });
});


//enter runs submit "enter" function
function enter(){
  $("#near").keyup(function(event){
      if(event.keyCode == 13){
          $("#near").click();
      }
  });
}


//getData from yelp, and write function are run
function getData() {
  var parameterMap = OAuth.getParameterMap(message.parameters);
  parameterMap.oauth_signature = OAuth.percentEncode(parameterMap.oauth_signature);
  $.ajax({
      'url': message.action,
      'data': parameterMap,
      'cache': true,
      'dataType': 'jsonp',
      'jsonpCallback': 'cb',
      'success': function(data, textStats, XMLHttpRequest) {
          gdata = data;
          console.log(data);
          //var output = prettyPrint(data);
          //$("body").append(output);
          
          businesses = [];

          _.each(gdata.businesses, function(business, index) {
            b = new Business(business.name, business.image_url, business.snippet_text, business.rating_img_url, business.url);
            businesses.push(b);
          });

          // writeToPage();
          writePageHeader();
          deleteContent();
          writePagecontent();
          random();
          writeRandomcontent();

  }
});

};
//Pull select information from api
function Business(name, image_url, snippet_text, rating_img_url, url) {
    this.name = name;
    this.image_url = image_url;
    this.snippet_text = snippet_text;
    this.rating_img_url = rating_img_url;
    this.url = url;
};

//display the item and location
function writePageHeader(){
    $("#nearlist").html(near);
    $("#termslist").html(terms);
};

//display the 10 results to page
function writePagecontent(){
  for(i = 0; i <= 10; i++){
    $(".list").append("<div class=\"media\"><a class=\"pull-left\" href=" + businesses[i].url + "><img class=\"media-object\" src=" + 
        businesses[i].image_url +  
        "></a><div class=\"media-body\"><h4 class=\"media-heading\">" + 
        businesses[i].name + 
        " <span><img class=\"reviewImg\" src=" + 
        businesses[i].rating_img_url + 
        "></span></h4>" +
        businesses[i].snippet_text +
        "</div>");
  }
};

// delete content after submit
function deleteContent(){
    $(".list").empty();
};

//choose a random number and assign to businesses
function random(){
    var restaurantnumber = Math.floor(Math.random() * 10);
    radrest = businesses[restaurantnumber];
}

//display random picture
function writeRandomcontent(){
    $(".random").html("<img src=" + radrest.image_url + " \"width=\"270px\" height=\"250px\">" + "<h4 class=\"list-group-item-heading\">" + radrest.name + "</h4>");
};

//random Button function
$(document).ready(function(){
    $('.randomButton').on("click", function(){
      random();
      writeRandomcontent();
});
});

getData();

