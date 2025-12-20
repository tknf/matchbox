import { authMap, config, pages } from "virtual:matchbox-pages";
import { createCgi } from "../dist/index.mjs";

const app = createCgi(pages, config, authMap);

export default app;
