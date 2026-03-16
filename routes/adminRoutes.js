const express = require("express");
const router = express.Router();

const Patient = require("../models/User");
const Psychiatrist = require("../models/User");
const Appointment = require("../models/Appointment");
const Review = require("../models/Review");


/* =========================
   MANAGE PATIENTS (FR_19)
========================= */

// get all patients
router.get("/patients", async (req, res) => {

const patients = await Patient.find();

res.json(patients);

});

// delete patient
router.delete("/patient/:id", async (req, res) => {

await Patient.findByIdAndDelete(req.params.id);

res.json({ message: "Patient deleted" });

});


/* =========================
   MANAGE PSYCHIATRISTS (FR_20)
========================= */




// 1️⃣ Get all psychiatrists
router.get("/psychiatrists", async (req, res) => {
  const psychiatrists = await Psychiatrist.find({
    role: "psychiatrist"
  });

  res.json(psychiatrists);
});

// 2️⃣ Approve psychiatrist
router.put("/approve/:id", async (req, res) => {
  try {
    await Psychiatrist.findByIdAndUpdate(req.params.id, {
      status: "Approved"
    });

    res.json({ message: "Psychiatrist approved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3️⃣ Reject psychiatrist
router.put("/reject/:id", async (req, res) => {
  try {
    await Psychiatrist.findByIdAndUpdate(req.params.id, {
      status: "Rejected"
    });

    res.json({ message: "Psychiatrist rejected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4️⃣ Delete psychiatrist
router.delete("/delete/:id", async (req, res) => {
  try {
    await Psychiatrist.findByIdAndDelete(req.params.id);
    res.json({ message: "Psychiatrist deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



/* =========================
   MANAGE APPOINTMENTS (FR_21)
========================= */

router.get("/appointments", async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("patient")
      .populate("psychiatrist");

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* =========================
   MANAGE REVIEWS (FR_22)
========================= */



router.get("/reviews", async (req, res) => {
  try {

    const reviews = await Review.find()
      .populate("patient", "fullName email")
      .populate("psychiatrist", "fullName email")
      .sort({ createdAt: -1 });

    res.json(reviews);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete("/reviews/delete/:id", async (req, res) => {

  try {

    await Review.findByIdAndDelete(req.params.id);

    res.json({ message: "Review deleted successfully" });

  } catch (err) {

    res.status(500).json({ message: err.message });

  }

});

module.exports = router;