import * as soap from "soap";
const wsdlURL = "http://gps.rcontrol.com.mx/Tracking/wcf/RCService.svc?singleWsdl";

async function GetToken() {
	try {
		const userId = process.env.NAVSTAR_USERNAME;
		const password = process.env.PASSWORD;
		const client = await soap.createClientAsync(wsdlURL);
		const response = await client.GetUserTokenAsync({
			userId, password
		});
		console.log(response);
		if (response)
			return response[0].GetUserTokenResponse;
	} catch (err) {
		console.error(err)
	}
}

async function SendData(assetTrackingData) {
	try {
		console.log(`Asset tracking data ->`);
		console.log(assetTrackingData);
		const client = await soap.createClientAsync(wsdlURL);
		const response = await GPSAssetTracking(client, assetTrackingData, 3);
		if (response) return response[0].GPSAssetTrackingResponse;
		return undefined
	} catch (err) {
		console.error(err)
	}
}
const GPSAssetTracking = async (client, data, n) => {
	try {
		return await client.GPSAssetTracking(data);
	} catch (err) {
		console.log(`n -> ${n} | error -> ${err}`);
		if (n === 1) throw err;
		return await GPSAssetTracking(client, data, n - 1);
	}
}

export {
	GetToken,
	SendData,
}
