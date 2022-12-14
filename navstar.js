import axios from "axios";
import { format, subSeconds } from "date-fns";

const baseURL = "http://navstar.com.mx/api-v2/"
function GmDate(eventTime) {
	let eventDate = new Date(eventTime);
	let parts = eventDate.toISOString().replace(/[TZ]/g, " ").split(" ");
	return parts[0].replace(/-/g, "") + parts[1].replace(/:/g, "").substring(0, 6);
}
const Auth = async () => {
	const login = process.env.NAVSTAR_USERNAME;
	const password = process.env.PASSWORD;

	const authRequest = await axios.post(baseURL + "user/auth", {
		login, password
	}, 3);
	return authRequest.data;
}
const GetTags = async (hash) => {
	try {
		const tag = process.env.TAG;

		const tagRequest = await axios.post(baseURL + "tag/list", {
			hash,
			filter: tag
		}, 3);
		const tagResponse = tagRequest.data;
		if (tagResponse && tagResponse.success === true) {
			return tagResponse.list.find(x => x.name === tag);
		}
	} catch (err) {
		console.log(err);
	}
}
const GetTrackers = async (hash) => {
	try {
		const trackerRequest = await axios.post(baseURL + "tracker/list", {
			hash,
		}, 3);
		const trackerResponse = trackerRequest.data;
		if (trackerResponse && trackerResponse.success === true) {
			return trackerResponse.list;
		}
	} catch (err) {
		console.log(err);
	}
}
const GetVehicles = async (hash) => {
	try {
		const vehicleRequest = await axios.post(baseURL + "vehicle/list", {
			hash,
		}, 3);
		if (vehicleRequest && vehicleRequest.data.success === true) {
			return vehicleRequest.data.list;
		}
	} catch (err) {
		console.log(err);
	}
}
const FetchObjects = async (hash, labels) => {
	try {
		//Fetch full list of tracker and vehicle
		const vehicles = await GetVehicles(hash);
		const trackers = await GetTrackers(hash);
		if (!vehicles) return [undefined, undefined];
		if (!trackers) return [undefined, undefined];
		// filter vehicles by label array
		const vehiclesResultList = vehicles.filter(v => {
			if (labels.includes(v.label)) return true;
			return false;
		})
		// extract tracker id from vehicles to filter tracker array
		const trackerIds = vehiclesResultList.map((value) => {
			return value.tracker_id
		})
		// filter tracker array
		const trackerResultList = trackers.filter(t => {
			if (trackerIds.includes(t.id)) return true
			return false
		});
		return [trackerResultList, vehiclesResultList];
	} catch (err) {
		console.log(err);
		return [undefined, undefined];
	}
}
const NeedsUpdate = async (hash, trackers, fireDate) => {
	try {
		console.log("Last check: " + fireDate);
		const historyRequest = await axios.post(baseURL + 'history/tracker/list',
			{
				hash,
				trackers: trackers.map(t => t.id),
				from: format(subSeconds(fireDate, 30), "yyyy-MM-dd HH:mm:ss"),
				to: format(fireDate, "yyyy-MM-dd HH:mm:ss")
			}, 3);
		if (historyRequest.data.success === true) {
			//Here we should filter out the events that are not being tracked
			return historyRequest.data.list;
		} else {
			console.log("Something went wrong at trying to fetch history events");
		}
	} catch (err) {
		console.log(err);
	}
}
const GetLastGPS = async (hash, tracker) => {
	try {
		const lastGPSrequest = await axios.post(baseURL + "tracker/get_last_gps_point", {
			hash,
			tracker_id: tracker.id
		}, 3);
		if (lastGPSrequest.data && lastGPSrequest.data.success === true) {
			return lastGPSrequest.data.value;
		}
	} catch (err) {
		console.log(err);
	}
}
const GetTrackerState = async (hash, tracker) => {
	try {
		const lastGPSrequest = await axios.post(baseURL + "tracker/get_state", {
			hash,
			tracker_id: tracker.id
		}, 3);
		if (lastGPSrequest.data && lastGPSrequest.data.success === true) {
			return lastGPSrequest.data.state;
		}
	} catch (err) {
		console.log(err);
	}
}
const GetTemp = async (hash, tracker) => {
	try {
		const diagnosticsRequest = await axios.post(baseURL + "tracker/get_diagnostics", {
			hash,
			tracker_id: tracker.id
		}, 3);
		if (diagnosticsRequest.data && diagnosticsRequest.data.success === true) {
			let inputs = diagnosticsRequest.data.inputs;
			let value;
			if (inputs && inputs.find(i => i.name === "can_engine_temp")) {
				value = inputs.find(i => i.name === "can_engine_temp");
			} else if (inputs.find(i => i.name === "can_coolant_t")) {
				value = inputs.find(i => i.name === "can_coolant_t");
			} else if (inputs && inputs.find(i => i.name === "obd_coolant_t")) {
				value = inputs.find(i => i.name === "obd_coolant_t");
			} else if (inputs.find(i => i.name === "obd_intake_air_t")) {
				value = inputs.find(i => i.name === "obd_intake_air_t");
			} else if (inputs.find(i => i.name === "can_intake_air_t")) {
				value = inputs.find(i => i.name === "can_intake_air_t");
			}
			if (value === undefined) {
				console.log("No temp. value could be found for: " + tracker.id);
				return null;
			}
			if (value.units_type !== 'celsius') {
				return ((value.value - 32) * 5) / 9;

			}
			return value.value;
		}
	} catch (err) {
		console.error(err);
	}
}
const GetOdometer = async (hash, tracker) => {
	try {
		const counterRequest = await axios.post(baseURL + "tracker/get_counters", {
			hash,
			tracker_id: tracker.id
		}, 3);
		if (counterRequest.data && counterRequest.data.success === true) {
			let res = counterRequest.data.list.find(e => e.type === "odometer");
			return res != undefined ? res.value : (null && console.log(`Odometer could not be found for: ${tracker.id}`));
		}
	} catch (err) {
		console.log(err);
	}
}
const GetDirection = (angle) => {
	var directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
	var index = Math.round(((angle %= 360) < 0 ? angle + 360 : angle) / 45) % 8;
	return directions[index];
}
const Geocoder = async (hash, tracker, location) => {
	try {
		const geocoderRequest = await axios.post(baseURL + "geocoder/search_location",
			{ hash, location }, 3);
		if (geocoderRequest.data && geocoderRequest.data.success === true) {
			let res = geocoderRequest.data.value;
			return res != undefined ? res : (null && console.log(`Geocoder could not be found for: ${tracker.id}`));
		}
	} catch (err) {
		console.log(err);
	}
}
const GetData = async (hash, event, history, tracker, vehicle) => {
	// If any attribute is called on a null object this method should return undefined to 
	// prevent sending the SOAP request
	try {
		console.log(`Getting data for ${history.id}`);
		// Fetch data from API 
		let trackerState = await GetTrackerState(hash, tracker);
		let lastGPS = await GetLastGPS(hash, tracker);
		let tempData = await GetTemp(hash, tracker);
		let odometer = await GetOdometer(hash, tracker);
		let addr = await Geocoder(hash, tracker, { lat: lastGPS.lat, lng: lastGPS.lng });
		// Create Data object (to send into SOAP service) 
		let result = {};
		result.altitude = trackerState.gps.alt;
		result.battery = trackerState.battery_level;
		result.code = event.code;
		result.course = GetDirection(lastGPS.heading);
		result.date = history.time;
		result.latitude = history.location.lat;
		result.longitude = history.location.lng;
		result.odometer = odometer != undefined ? `${odometer}` : null;
		result.serialNumber = vehicle.vin !== undefined && vehicle.vin.length > 0 ? vehicle.vin : tracker.source.device_id;
		result.speed = lastGPS != undefined ? `${lastGPS.speed}` : null;
		result.temperature = tempData != undefined ? `${tempData}` : null;
		result.asset = vehicle.reg_number !== undefined ? `${vehicle.reg_number}` : null;
		result.direction = addr != undefined ? `${addr}` : null;
		result.humidity = null;
		result.ignition = null;
		result.customer = { id: null, name: null };
		result.shipment = '0';
		return result;
	} catch (err) {
		console.error(err)
		return undefined
	}
}
const GetEventTypes = async (hash) => {
	try {
		const eventTypeListRequest = await axios.post(baseURL + "history/type/list",
			{ hash, locale: "Es-es" }, 3);
		if (eventTypeListRequest.data && eventTypeListRequest.data.success === true) {
			let res = eventTypeListRequest.data.list;
			return res != undefined ? res.value : (null && console.log(`Event types could not be found`));
		}
	} catch (err) {
		console.log(err);
	}
}
export {
	Auth,
	GetTags,
	FetchObjects,
	NeedsUpdate,
	GetData,
	GetEventTypes
};
