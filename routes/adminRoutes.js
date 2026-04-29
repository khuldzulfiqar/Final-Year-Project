const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Review = require("../models/Review");


/* =========================
   MANAGE PATIENTS (FR_19)
========================= */

// get all patients
router.get("/patients", async (req, res) => {
  try {
    const patients = await User.find({ role: "patient" });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/patient/:id", async (req, res) => {
  try {
    const patient = await User.findOne({
      _id: req.params.id,
      role: "patient"
    });

    if (!patient) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json(patient);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// delete patient
router.delete("/patient/:id", async (req, res) => {
  try {
    const patient = await User.findByIdAndDelete(req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.json({ message: "Patient deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});







/* =========================
   MANAGE PSYCHIATRISTS (FR_20)
========================= */




// 1️⃣ Get all psychiatrists
router.get("/psychiatrists", async (req, res) => {
  const psychiatrists = await User.find({
    role: "psychiatrist"
  });

  res.json(psychiatrists);
});

// 2️⃣ Approve psychiatrist
router.put("/approve/:id", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
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
    await User.findByIdAndUpdate(req.params.id, {
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
    await User.findByIdAndDelete(req.params.id);
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
    const { status, search } = req.query;

    let filter = {};

    // ✅ STATUS FILTER
    if (status) {
      filter.status = status;
    }

    let appointments = await Appointment.find(filter)
      .populate("patient")
      .populate("psychiatrist");

    // ✅ SEARCH FILTER
    if (search) {
      appointments = appointments.filter(app =>
        app.patient?.fullName.toLowerCase().includes(search.toLowerCase()) ||
        app.psychiatrist?.fullName.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json(appointments);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


/* =========================
   MANAGE REVIEWS (FR_22)
========================= */



router.get("/reviews", async (req, res) => {
  try {

    const { search } = req.query;

    let filter = {};

    let reviews = await Review.find()
      .populate("patient", "fullName email")
      .populate("psychiatrist", "fullName email")
      .sort({ createdAt: -1 });

    // ✅ SEARCH FILTER
    if (search) {
      reviews = reviews.filter(r =>
        r.patient?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        r.psychiatrist?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        r.comment?.toLowerCase().includes(search.toLowerCase())
      );
    }

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
router.get("/dashboard-counts", async (req, res) => {
  try {
    const [patients, psychiatrists, appointments, reviews] = await Promise.all([
      User.countDocuments({ role: "patient" }),
      User.countDocuments({ role: "psychiatrist" }),
      Appointment.countDocuments(),
      Review.countDocuments()
    ]);

    res.json({ patients, psychiatrists, appointments, reviews });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;