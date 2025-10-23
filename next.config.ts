import { withWorkflow } from "workflow";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	experimental: {
		serverMinification: false
	}
};

export default withWorkflow(nextConfig);
