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

let data = fs.readFileSync('./events.json', { encoding: 'UTF-8' });
const enabledEvents = JSON.parse(data);
const task = schedule.scheduleJob('*/5 * * * *', async function (fireDate) {
	try {
		console.log(`Expected time: ${fireDate}  Current time: ${new Date()}`);
		const auth = await Auth();
		if (auth) {
			const labels = [process.env.LABEL_1, process.env.LABEL_2, process.env.LABEL_3, process.env.LABEL_4];
			const [trackers, vehicles] = await FetchObjects(auth.hash, labels);
			const newEvents = await NeedsUpdate(auth.hash, trackers, fireDate);
			console.log(`Trackers -> ${trackers.length} ~ ${labels}`);
			/* trackers.forEach(element => {
				console.log(`Label -> ${element.label} `);
			}); */
			console.log(`Vehicles -> ${vehicles.length} `);
			/* vehicles.forEach(element => {
				console.log(`Label -> ${element.label} `);
			}); */
			console.log(`New events -> ${newEvents.length} `);
			newEvents.forEach(element => {
				console.log(`Event id -> ${element.id} | Event type -> ${element.event}`);
			});
			let token = await GetToken();
			console.log(`SOAP Token -> ${token.token}`);
			if (newEvents && newEvents.length > 0 && trackers && vehicles) {
				let attemptedEventCounter = 0;
				let updatedEventCounter = 0;
				enabledEvents.map(async (enabledEvent) => {
					let filteredEvents = newEvents.filter(newEvent => newEvent.event === enabledEvent.entity);
					filteredEvents.map(async (filteredEvent) => {
						attemptedEventCounter++;
						let tracker = trackers.find(t => t.id === filteredEvent.tracker_id);
						let vehicle = vehicles.find(v => v.tracker_id === tracker.id);
						const eventData = await GetData(auth.hash, enabledEvent, filteredEvent, tracker, vehicle);
						if (eventData !== undefined) {
							let soapResponse = await SendData(eventData, token);
							console.log(`SOAP response -> ${soapResponse}`);
							if (soapResponse)
								updatedEventCounter++;
							else
								console.log('There was a problem with the SOAP request')
							console.log(`#${updatedEventCounter}/${attemptedEventCounter} - have been synced`);
						} else {
							console.log('There was a problem computing the event data')
						}
					});
				});
			} else {
				console.log("There's no events to sync...");
			}
		} else {
			console.warn(`Auth error`);
		}
	} catch (err) {
		console.log(`Index task error ->`);
		console.error(err);
	}
});