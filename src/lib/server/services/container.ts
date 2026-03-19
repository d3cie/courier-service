import { AssignmentEngine } from '$lib/server/domain/assignment-engine';
import { OrderIntakeService } from '$lib/server/domain/order-intake-service';

export function createCourierServices() {
	const assignmentEngine = new AssignmentEngine();
	const orderIntakeService = new OrderIntakeService(assignmentEngine);

	return {
		assignmentEngine,
		orderIntakeService
	};
}
