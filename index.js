import "dotenv/config";
import schedule from "node-schedule";
import { Auth, NeedsUpdate, FetchObjects, GetData } from "./navstar.js";
import * as fs from "fs";
import { GetToken, SendData } from "./clientService.js";

//Load start art
console.log(`Programm starting
						       ...
	   /// //////      ((((((((/ ((((.     //// ........  .......  .........    ... .....
	  /////   //// (((((    (((( ((( ... (// ....    .   ...    ....     ...  .....   .
	 ////     /// ////      (((  (((( .((((  ......     ...    ...      ....  ...
	///      /// ///      ((((   ((( (((        .....  ...    ...      ...  ...
       ////     ///, *////  (((((     (((((    ...  ..... ...     ..... ......  ...
      ///      ///     ////( (((     #((      .......    ...       .........  ....        `);

//Load eventConfiguration from events.js
let data = fs.readFileSync('./events.json', { encoding: 'UTF-8' });
const eventConfiguration = JSON.parse(data);
const task = schedule.scheduleJob('*/30 * * * * *', async function (fireDate) {
	try {
		console.log(`Expected time: ${fireDate}  Current time: ${new Date()}`);
		const auth = await Auth();
		if (auth) {
			const labels = [process.env.LABEL_1, process.env.LABEL_2, process.env.LABEL_3, process.env.LABEL_4];
			console.log(labels);
			const [trackers, vehicles] = await FetchObjects(auth.hash, labels);
			const newEvents = await NeedsUpdate(auth.hash, trackers, fireDate);
			console.log(`Trackers ---> ${trackers.length} `);
			trackers.forEach(element => {
				console.log(`Label -> ${element.label} `);
			});
			console.log(`Vehicles ---> ${vehicles.length} `);
			vehicles.forEach(element => {
				console.log(`Label -> ${element.label} `);
			});
			console.log(`New events ---> ${newEvents.length} `);
			newEvents.forEach(element => {
				console.log(`Event id -> ${element.id} | Event type -> ${element.type}`);
			});
			let token = await GetToken();
			if (newEvents && newEvents.length > 0 && trackers && vehicles) {
				let enabledEvents = eventConfiguration.filter(e => e.type.length > 0);
				let attemptedEventCounter = 0;
				let updatedEventCounter = 0;
				enabledEvents.map(async function (evt) {
					let filteredEvents = newEvents.filter(ne => ne.event === evt.entity);
					filteredEvents.map(async function (fe) {
						attemptedEventCounter++;
						let tracker = trackers.find(t => t.id === fe.tracker_id);
						let vehicle = vehicles.find(v => v.tracker_id === tracker.id);
						const eventData = await GetData(auth.hash, evt, fe, tracker, vehicle);
						if (eventData !== undefined) {
							let soapResponse = await SendData(eventData);
							console.log(`SOAP response: ${soapResponse}`);
							if (soapResponse === true)
								updatedEventCounter++;
							else
								console.log('There was a problem with the SOAP request')
							console.log(`#${updatedEventCounter}/${attemptedEventCounter} - have been synced`);
						} else {
							console.log('There was a problem calculating the event data')
						}
					});
				});
			} else {
				console.log("There's no events to sync...");
			}
		}
	} catch (err) {
		console.error(err);
	}
});