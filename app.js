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
const nEvents = JSON.parse(data);
const task = schedule.scheduleJob('*/5 * * * *', async function (fireDate) {
	try {
		console.log(`Expected time: ${fireDate}  Current time: ${new Date()}`);
		const auth = await Auth();
		if (auth) {
			const labels = [process.env.LABEL_1, process.env.LABEL_2, process.env.LABEL_3, process.env.LABEL_4];
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
				let promiseArray = newEvents.map((newEvent) => {
					return GetSoapPayload(auth, newEvent, enabledEvents, trackers, vehicles);
				});
				Promise.all(promiseArray).then((soapPayload) => {
					console.log(`SOAP payload ->`);
					console.log(soapPayload);
					SendData(soapPayload, token).then((soapResponse) => {
						console.log(`SOAP response -> ${soapResponse}`);
						if (soapResponse)
							updatedEventCounter++;
						else
							console.log('There was a problem with the SOAP request')
						console.log(`#${updatedEventCounter}/${soapPayload.length} - have been synced`);
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

const GetSoapPayload = (auth, newEvent, enabledEvents, trackers, vehicles) => {
	return new Promise((resolve) => {
		if (enabledEvents.includes(newEvent.event)) {
			let eventCode = nEvents.find(e => e.entity === newEvent.event).code;
			let tracker = trackers.find(t => t.id === newEvent.tracker_id);
			let vehicle = vehicles.find(v => v.tracker_id === tracker.id);
			GetData(auth.hash, newEvent, eventCode, tracker, vehicle)
				.then((eventData) => {
					let soapPayload = { event: eventData };
					resolve(soapPayload);
				});
		}
	});
}