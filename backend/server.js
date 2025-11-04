import { getDistance } from 'geolib';
import salesman from 'salesman.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import smsWebhookRoutes from './routes/smsWebhook.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- Middlewares ---
app.use(cors());

// CRITICAL for Twilio: This parses the 'application/x-www-form-urlencoded' payload from Twilio
app.use(express.urlencoded({ extended: false }));

// Standard JSON middleware (for other routes)
app.use(express.json());

// --- Register Routes ---
// SMS Webhook for Twilio - All incoming SMS messages will be handled here
app.use('/api', smsWebhookRoutes);

// --- API Endpoint for Part 3 (Optimization) ---
app.post('/api/optimize-route', (req, res) => {
  const { depot, stops } = req.body;

  if (!depot || !stops) {
    return res.status(400).json({ detail: 'Missing depot or stops' });
  }

  console.log(`Received optimization request. Depot: ${depot.lat}, Stops: ${stops.length}`);

  // 1. Combine depot and stops (Depot must be index 0)
  const allLocations = [depot, ...stops];

  // 2. Call the AI solver
  try {
    const orderedRoute = solveTSP(allLocations);
    
    if (!orderedRoute) {
      return res.status(500).json({ detail: 'AI solver could not find a solution.' });
    }

    // 3. Send the same response as your Python app
    res.json({
      optimized_route: orderedRoute
    });

  } catch (e) {
    console.error(`Error during optimization: ${e}`);
    res.status(500).json({ detail: `An error occurred: ${e.message}` });
  }
});

function solveTSP(locations) {
  // 1. Create the list of points.
  // The salesman.js library just wants an array of {lat, lon} objects.
  // We'll rename them to 'x' and 'y' for the library, but it's just a name.
  const points = locations.map(loc => ({ x: loc.lat, y: loc.lon }));

  // 2. Define the distance function.
  // The library needs to know how to calculate the distance between two points.
  // We'll use 'geolib', which is the same as your Python 'geopy' library.
  const distanceFunction = (p1, p2) => {
    return getDistance(
      { latitude: p1.x, longitude: p1.y },
      { latitude: p2.x, longitude: p2.y }
    );
  };

  // 3. Solve the problem!
  // This runs the "Simulated Annealing" algorithm to find a great route.
  console.log('Solving optimization problem with salesman.js...');
  const solution = salesman.solve(points, distanceFunction);
  console.log('Node.js solution found!');

  // 4. Map the solution back to your original data.
  // The 'solution' is an array of INDICES (e.g., [0, 2, 1, 3])
  // We need to turn this back into an array of {lat, lon} objects.
  const orderedRoute = solution.map(index => locations[index]);
  
  // 5. Add the depot at the end to complete the loop
  orderedRoute.push(locations[0]);

  return orderedRoute;
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Disaster Response Resource Optimization Platform API' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Twilio Webhook URL: http://localhost:${PORT}/api/sms`);
  console.log(`Use ngrok to expose this URL for Twilio webhook configuration`);
});
