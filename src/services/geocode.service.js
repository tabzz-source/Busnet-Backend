const axios = require('axios')

exports.getCoordinates = async (placeName) => {
  const res = await axios.get(
    'https://photon.komoot.io/api/',
    {
      params: {
        q: `${placeName} Vietnam`,
        limit: 1,
      },
    }
  )

  if (!res.data.features || res.data.features.length === 0) {
    throw new Error('Location not found')
  }

  const feature = res.data.features[0]

  return {
    lat: feature.geometry.coordinates[1],
    lng: feature.geometry.coordinates[0],
    name: feature.properties.name,
  }
}

exports.getRouteInfo = async (origin, destination) => {
  const res = await axios.post(
    'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
    {
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    },
    {
      headers: {
        Authorization: process.env.ORS_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  )

  const summary = res.data.features[0].properties.summary

  return {
    distanceKm: Math.round(summary.distance / 1000),
    durationMin: Math.round(summary.duration / 60),
  }
}
