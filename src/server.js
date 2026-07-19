const dotenv = require("dotenv");

dotenv.config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const { sweepExpiredBans } = require("./services/banExpiry.service");

connectDB();
const expireBookingsJob = require("./jobs/expireBookings.job");
const completeArrivedBookingsJob = require("./jobs/completeArrivedBookings.job");

// No dedicated job runner in this codebase — a plain interval is enough for
// a single lightweight sweep. Mongoose buffers the query until the initial
// connectDB() finishes, so this is safe to start immediately.
const BAN_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const runBanSweep = () => {
  sweepExpiredBans()
    .then(({ swept }) => {
      if (swept > 0) {
        console.log(`Ban sweep: reactivated ${swept} account(s) with expired temporary bans`);
      }
    })
    .catch((err) => console.error("Ban sweep failed:", err.message));
};

runBanSweep();
setInterval(runBanSweep, BAN_SWEEP_INTERVAL_MS);

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
