import "dotenv/config";
import schedule from "node-schedule";
import { Auth, NeedsUpdate, FetchObjects, GetData } from "./navstar.js";
import * as fs from "fs";
import { GetToken, SendData } from "./clientService.js";
import { rejects } from "assert";

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
const nEvents = JSON.parse(data);
const task = schedule.scheduleJob('*/5 * * * *', async function(fireDate) {
	try {
		console.log(`Expected time: ${fireDate}  Current time: ${new Date()}`);
		const auth = await Auth();
		if (auth) {
			const labels = [process.env.LABEL_1, process.env.LABEL_2, process.env.LABEL_3, process.env.LABEL_4, process.env.LABEL_5, process.env.LABEL_6, process.env.LABEL_7];
			const [trackers, vehicles] = await FetchObjects(auth.hash, labels);
			const newEvents = await NeedsUpdate(auth.hash, trackers, fireDate);
			console.log(`New events -> ${newEvents.length} `);
			newEvents.forEach(element => {
				console.log(`Event id -> ${element.id} | Event type -> ${element.event}`);
			});
			let token = await GetToken();
			if (newEvents && newEvents.length > 0 && trackers && vehicles) {
				let updatedEventCounter = 0;
				let enabledEvents = nEvents.map((nEvent) => { return nEvent.entity });
				let filteredEvents = newEvents.filter(newEvent => enabledEvents.includes(newEvent.event));
				let promiseArray = filteredEvents.map((newEvent) => {
					return GetSoapPayload(auth, newEvent, trackers, vehicles);
				});
				Promise.all(promiseArray).then((eventArray) => {
					const soapPayload = { token: token.token, events: eventArray };
					console.log(`SOAP payload ->`);
					console.log(soapPayload);
					console.log('Events array -> ');
					console.log(eventArray);
					SendData(soapPayload).then((soapResponse) => {
						console.log(`SOAP response -> ${soapResponse}`);
						if (soapResponse)
							updatedEventCounter++;
						else
							console.log('There was a problem with the SOAP request')
						console.log(`#${updatedEventCounter}/${promiseArray.length} - have been synced`);
					});
				}).catch((e) => {
					console.log('There was a problem computing the event data');
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

const GetSoapPayload = (auth, newEvent, trackers, vehicles) => {
	return new Promise((resolve, reject) => {
		let eventCode = nEvents.find(e => e.entity === newEvent.event).code;
		let tracker = trackers.find(t => t.id === newEvent.tracker_id);
		let vehicle = vehicles.find(v => v.tracker_id === tracker.id);
		GetData(auth.hash, newEvent, eventCode, tracker, vehicle)
			.then((eventData) => {
				let soapPayload = { Event: eventData };
				resolve(soapPayload);
			}).catch((e) => reject(e));
	});
}
