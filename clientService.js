import * as soap from "soap";
const wsdlURL = "http://gps.rcontrol.com.mx/Tracking/wcf/RCService.svc?singleWsdl";

async function GetToken() {
	try {
		const userId = process.env.CLIENT_USERNAME;
		const password = process.env.CLIENT_PASSWORD;
		const client = await soap.createClientAsync(wsdlURL);
		const response = await client.GetUserTokenAsync({
			userId, password
		});
		if (response) return response[0].GetUserTokenResult;
	} catch (err) {
		console.log(`Client GetToken error ->`);
		console.error(err)
	}
}

async function SendData(eventData, token) {
	try {
		console.log(`Asset tracking data ->`);
		console.log(assetTrackingData);
		const client = await soap.createClientAsync(wsdlURL);
		const response = await GPSAssetTracking(client, token, eventData, 3);
		console.log(`Asset tracking response ->`);
		console.log(response);
		if (response) return response[0].GPSAssetTrackingResponse;
	} catch (err) {
		console.log(`Client SendData error ->`);
		console.error(err)
	}
}
const GPSAssetTracking = async (client, token, eventData, n) => {
	try {
		return await client.GPSAssetTracking({ token: token.token, events: eventData });
	} catch (err) {
		console.log(`GPSAssetTracking error ->`);
		console.error(err);
		if (n === 1) throw err;
		return await GPSAssetTracking(client, token, eventData, n - 1);
	}
}

export {
	GetToken,
	SendData,
}
