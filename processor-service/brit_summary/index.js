var Q = require('q'),count=0,cacheIds,users,views,batch,async = require('async');
var databaseUrl = "mongodb://0.0.0.0:27017/cw-api1";
var Db = require('mongodb');


var loki = require('lokijs'),db1 = new loki('/home/naveen/heirarchy.json');
var heirarchy;
var processor = Processor.subscribe({
  channels: ['processor:britannia_try','collector:pull:query_master']// can listen to multiple channels
})



function processSummaryAndSaveViews(vid){
	user = users[vid];
  	views.findOne({_id:vid},function(err,view){
    	console.log("Got the View "+view._id);
    	if(users[vid]){
            view.processedData.username = user["staff-name"]
            view.processedData.email = user["staff-email"]
            view.processedData.level = user.level
            view.processedData.code = user.code
            view.processedData.primarySales = Math.ceil(Number(user.primarySales)/1000)
            view.processedData.isSalesManOnGprs = user.is_sm_on_gprs
            view.processedData.firstHalfAttended = user.first_half_attend
            view.processedData.firstHalfOrders = user.first_half_orders
            view.processedData.secondHalfAttended = user.sec_half_attend
            view.processedData.secondHalfOrders = user.sec_half_orders
            view.processedData.isProcessed = false
            view.processedData.key = user.level + ":" + user.code
            view.processedData.parentCode = user["parent-code"]
            view.processedData.parentLevel = user["parent-level"]
            view.processedData.name = user["name"]
                if(user.level == 'distributor'){
                  view.processedData.awLastSyncDatetime = user["AW_last_sync_datetime"]
                }
          }
  		  views.find({_id:{$in:view.reporteeQuery}},{_id:1,"tmpSummary":1}).toArray(function(err,rv){
          	for(ri=0;ri<rv.length;ri++){
            //reportee's level and code
            tmpcache = rv[ri];
            console.log("Reportee : "+tmpcache._id);
            //tmpcache = cache[reportee[ri]["vpath"]];
            //tmpcache = heirarchy.findOne({vid:vid});
            	sales = [user["name"]||""];
                dist = [user["name"]||""];
                edge = [user["name"]||""];
                sales.push(tmpcache.tmpSummary.sales.BCR);
                sales.push(tmpcache.tmpSummary.sales.Dairy);
                dist.push(tmpcache.tmpSummary.dist.ECO);
                dist.push(tmpcache.tmpSummary.dist["New Outlets"]);
                edge.push(tmpcache.tmpSummary.edge.TLSD);
                view.processedData.body[1].content[0].data.push(sales);
                view.processedData.body[1].content[1].data.push(dist);
                view.processedData.body[1].content[2].data.push(edge);
          		if(ri+1 == rv.length){
          			console.log(view._id+" saving to batch execution.");
          			batch.insert(view);
          			if(ci.length==0){
          				console.log("Finally Executing the batch. Cheers");
          				cb();
          				/*batch.execute(function(err,result){
			              if(err){
			                console.log("Error");
			                console.log(err);
			                cb(err)
			              }
			              cb();
			              //d.resolve();
			            });*/			
          			}
          		}
          }
          console.log(vid+" Created");
          });
    });
}


/*function processSummaryAndSaveViews_old(){
	var d = Q.defer();
	if(cacheIds && users){
		ci = cacheIds;
		Db.MongoClient.connect(databaseUrl,{auto_reconnect: true }, function(err, db) {
			if(err) throw err;
			var views = db.collection("views");
			var batch = db.collection("views").initializeUnorderedBulkOp();
			//for(i=0;i<ci.length;ci++){
			while(ci.length>0){
				var id = ci.splice(0,1)[0];
				console.log(id);
				var vid = id._id;
				(function(vid){
		        	
		        })(vid);
			}
		});
	}
	return d.promise;
}*/

// function is mandatory, has access to the req object for extra details
// it MUST return a promise, use whatever
function acceptData(message) {
//console.log(message);
  var d = Q.defer()
  if(message.body && message.body.final){
  	//console.log(message.body);
  	count++;
  	if(message.body.note=="cache"){
  		console.log("Got Cache Data");
      //heirarchy = db1.loadCollection( {name:"children"} )
  		cacheIds = message.body.cache//,users
  	}else{
  		console.log("Got Users data");
  		users = message.body.users
  	}
  }
  //console.log(count);
  if(count ==1){
  	//start generating summary
  	console.log("Starting the Summary");
  	count=0;
  	Db.MongoClient.connect(databaseUrl,{auto_reconnect: true }, function(err, db) {
		db.collection('views').find({},{_id:1}).toArray(function(err,data){
			cacheIds=data;
			views = db.collection("views");
			batch = db.collection("finalViews").initializeUnorderedBulkOp();			
			async.each(cacheIds,processSummaryAndSaveViews,function(err){
				console.log("Saving Views");
				batch.execute(function(err,results){

				})
			});			
		});
	});
  	//As this is the final call prepare the final status and send a mail ..zi!!!
  }
  return d.promise
}
