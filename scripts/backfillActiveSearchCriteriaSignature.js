require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const ActiveSearch = require("../src/models/ActiveSearch");
const { buildCriteriaSignature, normalizeKeywords } = require("../src/helpers/activeSearchCriteria");

const run = async () => {
  await connectDB();

  const searches = await ActiveSearch.find({
    $or: [
      { criteriaSignature: { $exists: false } },
      { criteriaSignature: null },
      { criteriaSignature: "" },
    ],
  }).select("_id category keywords type");

  if (searches.length === 0) {
    console.log("No active searches require backfill.");
    await mongoose.disconnect();
    return;
  }

  const ops = searches.map((search) => {
    const keywords = normalizeKeywords(search.keywords || []);
    const criteriaSignature = buildCriteriaSignature({
      category: search.category,
      keywords,
      type: search.type,
    });

    return {
      updateOne: {
        filter: { _id: search._id },
        update: {
          $set: {
            keywords,
            criteriaSignature,
          },
        },
      },
    };
  });

  const result = await ActiveSearch.bulkWrite(ops, { ordered: false });
  console.log(`Backfilled active searches: ${result.modifiedCount}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Failed to backfill active searches:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
