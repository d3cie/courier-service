import { AssignmentEngine } from '$lib/server/domain/assignment-engine';
import { OrderIntakeService } from '$lib/server/domain/order-intake-service';
import { OutboxOutboundMessenger } from '$lib/server/services/outbound-messenger';

export function createCourierServices(options: { messageChannel?: string } = {}) {
	const outboundMessenger = new OutboxOutboundMessenger(options.messageChannel);
	const assignmentEngine = new AssignmentEngine(outboundMessenger);
	const orderIntakeService = new OrderIntakeService(assignmentEngine, outboundMessenger);

	return {
		outboundMessenger,
		assignmentEngine,
		orderIntakeService
	};
}
