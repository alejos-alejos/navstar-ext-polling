import * as soap from "soap";
const wsdlURL = "http://gps.rcontrol.com.mx/Tracking/wcf/RCService.svc?singleWsdl";

async function GetVersion() {
	try {
		const client = await soap.createClientAsync(wsdlURL);
		const response = await client.GetVersionAsync("tgd");
		return response[0].GetVersionResult;
	} catch (err) {
		console.log(err);
	}
}
async function GetToken(userId, password) {
	try {
		const client = await soap.createClientAsync(wsdlURL);
		const response = await client.GetUserTokenAsync({
			userId, password
		});
		console.log(response);
		return response[0].GetUserTokenResponse;
	} catch (err) {
		console.error(err)
	}
}

async function SendData(assetTrackingData) {
	try {
		const client = await soap.createClientAsync(wsdlURL);
		const response = await GPSAssetTracking(client, assetTrackingData, 3);
		console.log(response);
		return response[0].GPSAssetTrackingResponse;
	} catch (err) {
		console.error(err)
	}
}
const GPSAssetTracking = async (client, data, n) => {
	try {
		return await client.GPSAssetTracking(data);
	} catch (err) {
		if (n === 1) throw err;
		return await dbRetry(url, data, n - 1);
	}
}

export {
	GetVersion,
	GetToken,
	SendData,
}
