class Exception extends Error {
    constructor(message: string) {
        super(message)
    }
}

export class RepositoryAlreadyExistsException extends Exception {
    constructor(message: string) {
        super(message)
    }
}

export class RepositorySetupFailedException extends Exception {
    constructor(message: string) {
        super(message)
    }
}