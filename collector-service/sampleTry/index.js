var Q = require('q'),async = require("async"),outlet=0;
var databaseUrl = "mongodb://0.0.0.0:27017/cw-api";
var Db = require('mongodb'),startId,
tempLevel = {
  "region":"national",
  "area":"region",
  "som":"area",
  "territory":"som",
  "distributor":"territory",
  "salesman":"distributor",
  "outlet":"salesman"
},   MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server;
//var db = new Db('cw-api', new Server('localhost', 27017),{safe: false, strict: false});
var requestInterval = 5000 // 10 secs
//var fetchUrl = "http://115.249.190.247:8080/uCLMS/salesData?APIKey=hgd832384234&backlogin=1&";


    var collector = Collector.pull({
    flexible: true, // excdepr for scenario every field can be changed with subsqequent queries, defaults to false
    scenario: 'britannia-teams', // scenario
    path: "http://115.249.190.247:8080/uCLMS/salesData", //path
    method: 'get', // request method, default is get
    query: 'APIKey=hgd832384234&backlogin=1&level=national&code=CORP', // any query params
    body: ''
  })

  // listen to "refreshRequest" for real-time queries
  collector.on('refreshRequest', function (params) { // collectorName is mandarory for refreshers
  	Db.MongoClient.connect(databaseUrl, {
            auto_reconnect: true
        }, function(err, db) {

        	db.collection("cpStatus").insert({
        					title:"Collector started data extraction.",
        					from:"extractionCollector",
        					startedAt:Date.now()
        				},function(err,res){
    						// if required, check for conditions in params - for eg: caching
						    console.log('refreshRequest CALLED', params)
						     startId = res._id;
						    collector.request() // {} and collectorName mandarory for refreshers    					
        				});
        });
    
  })


  //Extract level and code from data
  /*Just saving the hierarchy users list and sending the each hierarchy 
  object to the processor for further processing.*/

  function extractData(data,parentLevel){
    var d = Q.defer(),flag=false;
      //var batch = db.collection("tmpHierarchy").initializeUnorderedBulkOp();
      //console.log("Connected to Mongo");
      var body = JSON.parse(data).data;
      var returnData={},level,code ;
      //var tmpUser = db.collection("tmpUser").initializeUnorderedBulkOp();
      var bodyReportee = Object.keys(body);
      //console.log(bodyReportee);
      for(ii = 0; ii < bodyReportee.length ; ii++ ){
        if(body[bodyReportee[ii]].reporteedata){
          for(i=0;i<body[bodyReportee[ii]].reporteedata.length;i++){
            //returnData[body[bodyReportee[ii]].reporteedata[i].level] = "level";
            level = body[bodyReportee[ii]].reporteedata[i].level;
            returnData[body[bodyReportee[ii]].reporteedata[i].code] = "code";
            //body[bodyReportee[ii]].reporteedata[i].reportsTo = parentLevel + ":" + bodyReportee[ii];
            //body[bodyReportee[ii]].reporteedata[i].vid = level +":"+body[bodyReportee[ii]].reporteedata[i].code;
            //batch.insert(body[bodyReportee[ii]].reporteedata[i]);
          	//flag = true;
          }  
        }
        if(ii+1 == bodyReportee.length){
      	   	var objKeys = Object.keys(returnData);
		    code = objKeys;
		    d.resolve({level:level,code:code});  	
        }
      }
    return d.promise;
  }
  // acceptData function is mandatory, has access to the res object for extra details
  // it MUST return a promise, use whatever
  function acceptData(err,message,headers) {
    var d = Q.defer();
    var final = false;
    parentLevel = headers.uri.split('&').slice(-2)[0].replace("level=","");
    if(parentLevel=="outlet"){
    	//console.log("Removing outlet");
    	outlet--;
    	if(outlet == 0){
    		Db.MongoClient.connect(databaseUrl, {
	            auto_reconnect: true
	        }, function(err, db) {

	        	db.collection("cpStatus").findAndModify({_id:startId},{endTime:Date.now()},function(err,doc){
	        		final = true;
	    			console.log("Ending Extracting Collector @ "+Date.now());
	        		process.nextTick(function () {
				    	//console.log("ticking "+outlet);
				      d.resolve({
				        id: Date.now(),
				        body: message.body,
				        final : final,
				        parentLevel : parentLevel
				      })
				    })
	        	});
	        });
	    }
    }
    else{
    	extractData(message.body,parentLevel).then(function(data){
	      if(data.code && data.code.length>0){
	      	//console.log("Level : "+data.level+" Codes : "+data.code.length);
	        while(data.code.length>0){
	          var reqCode = data.code.splice(0,499);
	          	if(data.level=="outlet"){
		        	//console.log("Adding Outlet");
		        	outlet++;
		        }
	          	collector.request({ // check cache before requesting again
		            //console.log("Level : "+data.level);
		            query : "APIKey=hgd832384234&backlogin=1&level="+data.level+"&code="+reqCode
		          });	
	          }            
	        }
	    });
	    process.nextTick(function () {
	    	//console.log("ticking "+outlet);
	      d.resolve({
	        id: Date.now(),
	        body: message.body,
	        final : final,
	        parentLevel : parentLevel
	      })

	    })	
    }
    

    return d.promise
  }

  //db.close();
