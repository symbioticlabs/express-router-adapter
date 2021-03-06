import { Request } from 'express';
import { IHTTPResponse } from './HTTPResponse';

/**
 * This builds the necessary state for the ExpressRouterAdapter
 *
 * This is forward looking to decorators which might look like this
 *
 *  @httpGet('/organizations/:orgId/opportunities')
 *  @mediaType(() => OppListingFormatter)
 *  @query('onOrAfter')
 *  async getOpportunities({ orgId, onOrAfter }){
 *      return await opportunityManager.getOpportunitiesByOrganization({ orgId, onOrAfter });
 *  }
 */
export interface IBaseControllerParams {
    req: Request;
    body?: any;
    model?: any;
    securityContext: any;
}

// ControllerParams also includes some unknown string values
// from path params (e.g. the key 'bar' is a string on controller params if the path is /foo/:bar)
// from any calls to query (e.g. the key 'biz' is a string on controller params if you call query('biz'))
export type IControllerParams = IBaseControllerParams & { [key: string]: string; };

type RouteHandler = (controllerParams?: IControllerParams) => any;
type HTTPVerbSetter = (defaultHandler: RouteHandler) => IHTTPRoute;

export interface IMediaTypeFormatter {
    mediaType: string;
    formatForResponse: (model: any, params: { req: Request }) => IHTTPResponse | any;
    formatFromRequest: (body: any, params: { req: Request }) => any;
}

export interface IHTTPRoute {
    httpVerb: 'get' | 'post' | 'delete' | 'put' | 'patch';
    httpPath: string;
    mediaTypeFormatters: Array<{ formatter: IMediaTypeFormatter, handler?: RouteHandler }>;
    httpQueryParams: string[];
    allowAnonymous: boolean;
    defaultHandler?: RouteHandler;
    timeout?: string | number;
}

export class RouterMetaBuilder {
    private state: any;

    public get: HTTPVerbSetter;
    public post: HTTPVerbSetter;
    public delete: HTTPVerbSetter;
    public put: HTTPVerbSetter;
    public patch: HTTPVerbSetter;

    constructor(state: any = { }) {
        this.state = state;

        const verbs = ['get', 'post', 'delete', 'put', 'patch'];
        verbs.forEach((verb) => {
            this[verb] = (defaultHandler: RouteHandler): IHTTPRoute => {
                if (defaultHandler) {
                    return new RouterMetaBuilder({ ...this.state, verb, defaultHandler }).build();
                } else {
                    return new RouterMetaBuilder({ ...this.state, verb }).build();
                }
            };
        });
    }

    build = (): IHTTPRoute => {
        const { path, mediaTypeFormatters, verb, queryKeys, allowAnonymous, defaultHandler, timeout } = this.state;

        return {
            httpVerb: verb,
            httpPath: path,
            mediaTypeFormatters,
            httpQueryParams: queryKeys,
            allowAnonymous,
            defaultHandler,
            timeout
        };
    }

    path = (path: string): RouterMetaBuilder => {
        return new RouterMetaBuilder({ ...this.state, path });
    }

    mediaType = (mediaTypeFormatter: IMediaTypeFormatter, handler?: RouteHandler): RouterMetaBuilder => {
        const mediaTypeFormatters = this.state.mediaTypeFormatters || [];

        // we attempted to do this with WeakMap but it isn't practical to clone so we fell back to this
        //  we also considered maintaining a parallel sparse array but felt like this tradeoff was slightly
        //  better than that
        return new RouterMetaBuilder({
            ...this.state,
            mediaTypeFormatters : [ ...mediaTypeFormatters, { formatter: mediaTypeFormatter, handler } ]
        });
    }

    query = (...queryKeys: string[]): RouterMetaBuilder => {
        return new RouterMetaBuilder({ ...this.state, queryKeys : [...(this.state.queryKeys || []), ...queryKeys] });
    }

    allowAnonymous = (): RouterMetaBuilder => {
        return new RouterMetaBuilder({ ...this.state, allowAnonymous : true });
    }

    /**
     * Set a max timeout for the route, after which a 503 status code will be returned
     *
     * @param timeout - The timeout in milliseconds or as a string understood by the ms library
     * Example: '5m' for 5 minutes, see https://www.npmjs.com/package/ms
     */
    timeout = (timeout: string | number): RouterMetaBuilder => {
        return new RouterMetaBuilder({ ...this.state, timeout });
    }
}
