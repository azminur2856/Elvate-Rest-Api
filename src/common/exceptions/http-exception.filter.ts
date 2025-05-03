// import {
//   ExceptionFilter,
//   Catch,
//   ArgumentsHost,
//   HttpException,
//   HttpStatus,
//   Logger,
// } from '@nestjs/common';
// import { Request, Response } from 'express';

// @Catch(HttpException)
// export class HttpExceptionFilter implements ExceptionFilter {
//   private readonly logger = new Logger(HttpExceptionFilter.name);

//   catch(exception: HttpException, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse<Response>();
//     const request = ctx.getRequest<Request>();
//     const status = exception.getStatus();
//     const exceptionResponse = exception.getResponse();

//     // Log the exception
//     this.logger.error(
//       `${request.method} ${request.url} - Status: ${status} - ${JSON.stringify(exceptionResponse)}`,
//     );

//     // Format the response
//     const errorResponse = {
//       statusCode: status,
//       timestamp: new Date().toISOString(),
//       path: request.url,
//       method: request.method,
//       message: typeof exceptionResponse === 'string' 
//         ? exceptionResponse 
//         : (exceptionResponse as any).message || exception.message,
//       error: (exceptionResponse as any).error || HttpStatus[status],
//     };

//     response.status(status).json(errorResponse);
//   }
// } 