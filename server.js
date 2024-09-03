const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const colors = require("colors");
const cookieParser = require("cookie-parser");
const { IPinfoWrapper } = require("node-ipinfo");

const ipinfo = new IPinfoWrapper(process.env.IPINFO_API_KEY);

// console.log(ipinfo);

const connectDB = require("./config/db");

//! error Middleware
const errorMiddleware = require("./middleware/errorMiddleware");

//?rout files
const bootcamps = require("./routes/bootcampsRoutes");
const courses = require("./routes/coursesRoutes");
const auth = require("./routes/authRoute");

//? Load environment variables from the config file
dotenv.config({ path: "./config/config.env" });

connectDB();

//? initial app
const app = express();

//? using body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}
//! initialize middleware
// app.use(logger);

//? Mount Routes
app.use("/api/v1/bootcamps", bootcamps);
app.use("/api/v1/courses", courses);
app.use("/api/v1/auth", auth);
//! Mount Error
app.use(errorMiddleware);

const PORT = process.env.PORT || 9000;

app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.bgMagenta
  );
});

process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  //? close server and exit
  server.close(() => process.exit(1));
});
