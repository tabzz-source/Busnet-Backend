const dotenv = require("dotenv");

dotenv.config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const expireBookingsJob = require("./jobs/expireBookings.job");
const completeArrivedBookingsJob = require("./jobs/completeArrivedBookings.job");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BusNet Backend API is running successfully",
    project: "BusNet",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: `${Math.floor(process.uptime())} seconds`,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api", routes);

// Error middlewares 
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startBookingJobs = () => {
  let isRunning = false;

  const runBookingJobs = async () => {
    if (isRunning) return;

    isRunning = true;
    try {
      const [expiredResult, completedResult] = await Promise.all([
        expireBookingsJob(),
        completeArrivedBookingsJob(),
      ]);

      if (expiredResult.expiredCount > 0) {
        console.log(`[Booking Jobs] Expired stale bookings: ${expiredResult.expiredCount}`);
      }

      if (completedResult.completedBookingCount > 0) {
        console.log(
          `[Booking Jobs] Completed arrived bookings: ${completedResult.completedBookingCount}`,
        );
      }
    } catch (error) {
      console.error("[Booking Jobs] Failed to process booking jobs:", error);
    } finally {
      isRunning = false;
    }
  };

  runBookingJobs();
  setInterval(runBookingJobs, 60 * 1000);
};

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startBookingJobs();
  });
};

startServer();
