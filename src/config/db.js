const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    // Auto-create all collections from model files
    const modelsDir = path.join(__dirname, "..", "models");
    const modelFiles = fs.readdirSync(modelsDir).filter((file) => file.endsWith(".js"));

    let created = 0;
    for (const file of modelFiles) {
      try {
        const model = require(path.join(modelsDir, file));
        if (model && model.createCollection) {
          await model.createCollection();
          created++;
        }
      } catch (err) {
        console.warn(`⚠ Skipped ${file}: ${err.message}`);
      }
    }
    console.log(`✅ ${created}/${modelFiles.length} collections initialized`);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;