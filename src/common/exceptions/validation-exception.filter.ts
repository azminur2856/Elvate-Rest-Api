import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Request, Response } from 'express';

interface ValidationErrorItem {
  field?: string;
  message: string;
}

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Log the exception
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - ${JSON.stringify(exceptionResponse)}`,
    );

    // Format validation errors
    let validationErrors: ValidationErrorItem[] = [];
    
    if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
      const messages = (exceptionResponse as any).message;
      
      if (Array.isArray(messages)) {
        // Handle array of validation messages
        validationErrors = this.formatValidationErrors(messages);
      } else if (typeof messages === 'string') {
        // Handle single validation message
        validationErrors = [{ message: messages }];
      } else if (typeof messages === 'object') {
        // Handle nested validation errors (from class-validator)
        validationErrors = this.formatNestedValidationErrors(messages as ValidationError[]);
      }
    }

    // Format the response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: 'Validation failed',
      errors: validationErrors,
    };

    response.status(status).json(errorResponse);
  }

  private formatValidationErrors(errors: string[]): ValidationErrorItem[] {
    return errors.map(error => {
      // Try to parse constraint error messages
      const constraintMatch = error.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
      if (constraintMatch) {
        return {
          field: constraintMatch[1],
          message: constraintMatch[2],
        };
      }
      return { message: error };
    });
  }

  private formatNestedValidationErrors(errors: ValidationError[]): ValidationErrorItem[] {
    const formattedErrors: ValidationErrorItem[] = [];
    
    const extractErrors = (error: ValidationError, parentField = '') => {
      const field = parentField ? `${parentField}.${error.property}` : error.property;
      
      // Use type assertion to handle the constraints property
      const constraints = error.constraints as Record<string, string> | undefined;
      if (constraints && Object.keys(constraints).length > 0) {
        Object.keys(constraints).forEach(key => {
          formattedErrors.push({
            field,
            message: constraints[key],
          });
        });
      }
      
      if (error.children && error.children.length > 0) {
        error.children.forEach(child => extractErrors(child, field));
      }
    };
    
    errors.forEach(error => extractErrors(error));
    return formattedErrors;
  }
} 