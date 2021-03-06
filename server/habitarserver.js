Meteor.startup(function () {
    // code to run on server at startup
    later.date.localTime();
    var dailyReset = new ScheduledTask('at 11:59 pm', function () {
    	Meteor.call("resetDailyYos", function(error, result) {
		  	console.log('successfully reset daily yos to 0, ' + result);
		});

    	// reset coach personality
		Meteor.users.update({}, {$set:{"cAttitude": 0}}, { multi: true });

		// Adjust wellness- add up # tasks completed (40% = same, <40% = subtract, >40% = add)
		var users = Meteor.users.find();
		var count = users.count();
		for (i = 0; i < count; i++) {
			var user = users.fetch()[i];
			var total_tasks = 0;
			var tasks_completed = 0;
			Tasks.find({'createdBy':user._id}).forEach(function(task) {
				total_tasks++;
				if (task.completed == 1) {
					tasks_completed++;
				}
			});
			var fraction = tasks_completed/total_tasks;
			if (fraction < 0.4) {
				Meteor.users.update({_id: user._id}, {$set:{"wellness": user.wellness - (1 - fraction)*10}});
			} else if (fraction > 0.4) {
				Meteor.users.update({}. user.wellness + (fraction)*10);
			}
			if (user.wellness <= 20) {
				Meteor.call("yoUser", user.yoUsername, function(error, result) {
					console.log("successfully yo'd user, " + result);
				});
			}
		}
		Tasks.update({}, {$set:{"completed": 0}}, { multi: true });
	});
	dailyReset.start();

	var sendReminderYos = new ScheduledTask('at 8:00 pm', function () {
		Meteor.call("sendReminderYos", function(error, result) {
			console.log('successfully sent all reminder yos for the day, ' + result);
		});
	});
	sendReminderYos.start();
});


// API methods
Meteor.methods({
	// Yo
	yoUser: function (username) {
		console.log("Yoing user");
		try {
			var result = HTTP.call("POST", "https://api.justyo.co/yo/",
		                       {params: {username: username, api_token: "6c1e9f8b-2f57-4c51-a019-e8f9a39daaa1", link: "http://habitar.me/portal"}});
			return true;
		} catch (e) {
			// Got a network error, time-out or HTTP error in the 400 or 500 range.
			return false;
		}
	},

	yoHabitar: function (username) {
		console.log("Yoing habitar");
		Meteor.users.update({_id: Meteor.user()._id}, {$inc: {"wellness": 1}});
		Meteor.users.update({_id: Meteor.user()._id}, {$inc: {"daily_yos": 1}});
	},

	// every night at midnight- reset daily yos for all users!
	resetDailyYos: function () {
		console.log("Resetting daily yos");
		Meteor.users.update({}, {$set:{"daily_yos": 0}}, { multi: true });
	},

	// send reminder yos
	sendReminderYos: function() {
		// Send user a yo at 8pm if they haven't checked on their habitar all day; note: in the future, the time can be changed in settings!
		// Return today's date and time
		var currentTime = new Date();
		// returns the month (from 0 to 11)
		var month = currentTime.getMonth();
		// returns the day of the month (from 1 to 31)
		var day = currentTime.getDate();
		// returns the year (four digits)
		var year = new Date().getFullYear();
		var users = Meteor.users.find({"lastVisited": {"$not": {"$gte": new Date(year, month, day), "$lt": new Date(year, month, day + 1)}}});
		var count = users.count();
		console.log(count + " users " + users);
		for (i = 0; i < count; i++) {
			Meteor.call("yoUser", users.fetch()[i].yoUsername, function(error, result) {
				console.log("successfully yo'd users, " + result);
			});
		}
	},

	// Wolfram Alpha
	getFacts: function (subject, category) {
		console.log("Preparing fun fact");
		var base_url = "http://api.wolframalpha.com/v2/query";
		try {
			var result = HTTP.call("GET", base_url,
		                       {params: {appid: "L653XY-7XQ7RY2KX7", input: subject, format: "plaintext"}});

			var xml = result.content;
			if (category == "food") {
				var n = xml.indexOf("total calories");
				var pos = n + 16;
				var calories = xml.substring(pos).split(" ")[0];
				console.log(calories);
				var unhealthy_food = randomKey(food);
				var unhealthy_cal = food[unhealthy_food];
				var proportion = Math.ceiling(unhealthy_food/parseInt(calories));
				var fact = "Did you know that eating " + proportion + " " + subject + "s is equivalent to eating a " + unhealthy_food + "? Keep up the good work, and don't forget your " + subject + "s!";
			} else if (category == "fitness") {
				var n = xml.indexOf("energy expenditure rate");
				var pos = n + 26;
				var rate = xml.substring(pos).split(" ")[0];
				console.log(rate);
				var cal_per_min = parseInt(rate) * 150 / 60;
				console.log("calories per minute: " + cal_per_min);
				var fact = "Doing " + subject + " for just one minute burns " + cal_per_min + " calories- you got this!";
			}
			console.log(fact);
			return fact;
		} catch (e) {
			// Got a network error, time-out or HTTP error in the 400 or 500 range.
			return e;
		}
	}
});

var food = {};
food["Big Mac"] = 550;
food["French Fries"] = 288;
food["Taco"] = 184;
food["Whopper"] = 640;
food["Milkeshake"] = 285;

function randomKey(obj) {
    var ret;
    var c = 0;
    for (var key in obj)
        if (Math.random() < 1/++c)
           ret = key;
    return ret;
}
