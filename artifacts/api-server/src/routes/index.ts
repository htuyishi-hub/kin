import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import auth0AuthRouter from "./auth0Auth.js";
import meRouter from "./me.js";
import photosRouter from "./photos.js";
import promptsRouter from "./prompts.js";
import vouchesRouter from "./vouches.js";
import matchQueueRouter from "./matchQueue.js";
import interestsRouter from "./interests.js";
import matchesRouter from "./matches.js";
import messagesRouter from "./messages.js";
import reportsRouter from "./reports.js";
import paymentsRouter from "./payments.js";
import { requireAuth } from "../middlewares/auth.js";
import { verifyURRegistration } from "./urVerification.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(auth0AuthRouter);
router.use(meRouter);
router.use(photosRouter);
router.use(promptsRouter);
router.use(vouchesRouter);
router.use(matchQueueRouter);
router.use(interestsRouter);
router.use(matchesRouter);
router.use(messagesRouter);
router.use(reportsRouter);
router.use(paymentsRouter);

// Phase 2: UR registration verification
router.post("/me/ur/verify-registration", requireAuth, verifyURRegistration);

export default router;

