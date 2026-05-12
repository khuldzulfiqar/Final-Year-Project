const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Review = require("../models/Review");
const nodemailer = require("nodemailer");

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}


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
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    await User.findByIdAndDelete(req.params.id);

    // 📩 EMAIL SEND
    await createTransporter().sendMail({
      from: `"MindBridge Admin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Account Deleted - MindBridge",
      html: `
        <div style="font-family:Arial;padding:20px">
          <h2>Hello ${user.fullName}</h2>
          <p>Your <b>patient account</b> has been deleted by admin.</p>
          <p>If you think this is a mistake, please contact support.</p>
        </div>
      `
    });

    res.json({ message: "Patient deleted + email sent" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});







/* =========================
   MANAGE PSYCHIATRISTS (FR_20)
========================= */




// Get single psychiatrist by ID — for View Profile modal
router.get("/psychiatrist/:id", async (req, res) => {
  try {
    const psychiatrist = await User.findOne({ _id: req.params.id, role: "psychiatrist" });
    if (!psychiatrist) return res.status(404).json({ message: "Psychiatrist not found" });
    res.json(psychiatrist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 1️⃣ Get all psychiatrists
router.get("/psychiatrists", async (req, res) => {
  try {
    const { search } = req.query;
    let filter = { role: "psychiatrist" };

    if (search) {
      const regex = new RegExp(search, "i");
      filter["$or"] = [
        { fullName: regex },
        { email: regex },
        { specialization: regex }
      ];
    }

    const psychiatrists = await User.find(filter);
    res.json(psychiatrists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2️⃣ Approve psychiatrist
router.put("/approve/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "Approved" },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    // 📩 EMAIL SEND
    await createTransporter().sendMail({
      from: `"MindBridge Admin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "🎉 Account Approved - MindBridge",
      html: `
        <div style="font-family:Arial;padding:20px">
          <h2>Congratulations ${user.fullName}</h2>
          <p>Your psychiatrist account has been <b>APPROVED</b> by admin.</p>
          <p>You can now login and start receiving appointments.</p>
        </div>
      `
    });

    res.json({ message: "Psychiatrist approved + email sent" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3️⃣ Reject psychiatrist
router.put("/reject/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "Rejected" },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    // 📩 EMAIL SEND
    await createTransporter().sendMail({
      from: `"MindBridge Admin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Account Rejected - MindBridge",
      html: `
        <div style="font-family:Arial;padding:20px">
          <h2>Hello ${user.fullName}</h2>
          <p>Sorry, your psychiatrist account has been <b>REJECTED</b> by admin.</p>
          <p>You may contact support for more details.</p>
        </div>
      `
    });

    res.json({ message: "Psychiatrist rejected + email sent" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4️⃣ Delete psychiatrist
router.delete("/delete/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Psychiatrist not found" });
    }

    await User.findByIdAndDelete(req.params.id);

    // 📩 EMAIL SEND
    await createTransporter().sendMail({
      from: `"MindBridge Admin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Account Deleted - MindBridge",
      html: `
        <div style="font-family:Arial;padding:20px">
          <h2>Hello Dr. ${user.fullName}</h2>
          <p>Your <b>psychiatrist account</b> has been deleted by admin.</p>
          <p>You will no longer be able to access the system.</p>
        </div>
      `
    });

    res.json({ message: "Psychiatrist deleted + email sent" });

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